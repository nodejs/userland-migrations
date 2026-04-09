import type { SgRoot } from '@codemod.com/jssg-types/main';
import type Json from '@codemod.com/jssg-types/langs/json';
import { intersects, satisfies, validRange } from '@vltpkg/semver';

const REQUIRED_NODE_ENGINE = '^20.19.0 || >=22.12.0';
const REQUIRED_NODE_ANCHORS = ['20.19.0', '20.20.0', '22.12.0', '24.0.0'];

/**
 * Given a current node engine range, returns the best next node engine range to use for an ESM package.
 * If the current range is invalid, doesn't intersect with the required range, or doesn't cover all the required anchors, the required range will be returned.
 * Otherwise, the current range will be returned.
 * This allows to preserve custom node engine ranges as much as possible, while ensuring the resulting range is valid for ESM packages.
 * @param current The current node engine range.
 * @returns The best next node engine range to use for an ESM package.
 */
function chooseBestNodeEngine(current: unknown): string {
	if (typeof current !== 'string' || !validRange(current)) {
		return REQUIRED_NODE_ENGINE;
	}

	if (current === REQUIRED_NODE_ENGINE) {
		return current;
	}

	if (!intersects(current, REQUIRED_NODE_ENGINE)) {
		return REQUIRED_NODE_ENGINE;
	}

	const coversRequiredAnchors = REQUIRED_NODE_ANCHORS.every((version) =>
		satisfies(version, current),
	);

	return coversRequiredAnchors ? REQUIRED_NODE_ENGINE : current;
}

function replaceModulePathSuffixes(value: string): string {
	return value.replace(/\.cjs$/g, '.mjs').replace(/\.cts$/g, '.mts');
}

function rewriteStringValues(value: unknown): boolean {
	if (!value || typeof value !== 'object') {
		return false;
	}

	let hasChanges = false;

	if (Array.isArray(value)) {
		for (let i = 0; i < value.length; i += 1) {
			const item = value[i];
			if (typeof item === 'string') {
				const nextItem = replaceModulePathSuffixes(item);
				if (item !== nextItem) {
					value[i] = nextItem;
					hasChanges = true;
				}
				continue;
			}

			if (rewriteStringValues(item)) {
				hasChanges = true;
			}
		}

		return hasChanges;
	}

	const objectValue = value as Record<string, unknown>;
	for (const [key, item] of Object.entries(objectValue)) {
		if (typeof item === 'string') {
			const nextItem = replaceModulePathSuffixes(item);
			if (item !== nextItem) {
				objectValue[key] = nextItem;
				hasChanges = true;
			}
			continue;
		}

		if (rewriteStringValues(item)) {
			hasChanges = true;
		}
	}

	return hasChanges;
}

/**
 * @see https://github.com/nodejs/package-examples/tree/main/guide/05-cjs-esm-migration/migrating-package-json
 */
export default function transform(root: SgRoot<Json>): string | null {
	const text = root.source();
	const pckgJson = JSON.parse(text) as Record<string, unknown>;

	let hasChanges = false;

	if (pckgJson.type !== 'module') {
		pckgJson.type = 'module';
		hasChanges = true;
	}

	if (
		typeof pckgJson.engines !== 'object' ||
		pckgJson.engines === null ||
		Array.isArray(pckgJson.engines)
	) {
		pckgJson.engines = {
			node: REQUIRED_NODE_ENGINE,
		};
		hasChanges = true;
	} else {
		const engines = pckgJson.engines as Record<string, unknown>;
		const currentNodeEngine = engines.node;
		const nextNodeEngine = chooseBestNodeEngine(currentNodeEngine);

		if (currentNodeEngine !== nextNodeEngine) {
			engines.node = nextNodeEngine;
			hasChanges = true;
		}
	}

	if (rewriteStringValues(pckgJson)) {
		hasChanges = true;
	}

	if (!hasChanges) {
		return null;
	}

	return `${JSON.stringify(pckgJson, null, 2)}\n`;
}

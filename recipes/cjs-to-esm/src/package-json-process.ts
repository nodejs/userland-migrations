import type { SgRoot } from '@codemod.com/jssg-types/main';
import type Json from '@codemod.com/jssg-types/langs/json';
import type { PackageJson } from 'type-fest';
import { intersects, satisfies, validRange } from '@vltpkg/semver';

/**
 *
 * Why these versions:
 * - `20.19.0` is the first Node 20 release in which `require(esm)` is available without the warning.
 * - `22.12.0` is the equivalent baseline in the Node 22 line.
 * - `24.0.0` represents the first Node 24 release (future/current line) and keeps the rule forward-compatible.
 *
 * The anchor list is used as a safety check: a user-provided semver range must include these
 * representative versions across supported majors, not just technically intersect the baseline.
 */
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
	return value.replace(/\.cjs$/, '.mjs').replace(/\.cts$/, '.mts');
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
	const pckgJson = JSON.parse(text) as PackageJson;

	let hasChanges = false;

	if (pckgJson.type !== 'module') {
		pckgJson.type = 'module';
		hasChanges = true;
	}

	if (
		pckgJson.engines == null ||
		typeof pckgJson.engines !== 'object' ||
		Array.isArray(pckgJson.engines)
	) {
		pckgJson.engines = {
			node: REQUIRED_NODE_ENGINE,
		};
		hasChanges = true;
	} else {
		const { engines } = pckgJson;
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

	const indentMatch = text.match(/^[ \t]+(?=")/m);
	const indent = indentMatch?.[0] ?? 2;

	return `${JSON.stringify(pckgJson, null, indent)}\n`;
}

import { isBuiltin } from 'node:module';
import { extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

import { jsExts, tsExts } from './exts.ts';
import type { FSAbsolutePath, ResolvedSpecifier } from './index.d.ts';
import { resolvesToNodeModule } from './resolves-to-node-module.ts';
import { getNotFoundUrl } from './get-not-found-url.ts';

/**
 * Whether the specifier can be completely ignored.
 * @param parentPath The module containing the provided specifier
 * @param specifier The specifier to check.
 */
export function isIgnorableSpecifier(
	parentPath: FSAbsolutePath,
	specifier: string,
) {
	if (isBuiltin(specifier)) return true;
	if (specifier.startsWith('data:')) return true;

	const ext = extname(specifier);
	// @ts-expect-error
	if (tsExts.includes(ext)) return true;
	// @ts-expect-error
	if (jsExts.includes(ext)) return false;
	if (ext) return true; // There is an extension and it's not TS or suspect

	if (specifier[0] === '@') return true; // namespaced node module

	if (specifier[0] === sep /* '/' */) return false;
	if (specifier.startsWith(`.${sep}`) /* './' */) return false;
	if (specifier.startsWith('..')) return false;
	if (specifier.startsWith('file://')) return false;
	if (isMatchInTsConfigPaths(specifier)) return false;
	if (specifier.startsWith('#')) return true;

	const importMetaResolve = (
		import.meta as { resolve?: (specifier: string, parent?: string) => string }
	).resolve;
	if (typeof importMetaResolve !== 'function') return true;

	let resolvedSpecifier: ResolvedSpecifier | undefined;
	try {
		resolvedSpecifier = importMetaResolve(
			specifier,
			pathToFileURL(parentPath).href,
		) as ResolvedSpecifier; // This requires `--experimental-import-meta-resolve`
	} catch (err) {
		if (
			!(err instanceof Error) ||
			!IGNORABLE_RESOLVE_ERRORS.has((err as NodeJS.ErrnoException).code!)
		)
			throw err;

		resolvedSpecifier = getNotFoundUrl(err);
	}

	if (
		resolvedSpecifier &&
		resolvesToNodeModule(resolvedSpecifier, parentPath, specifier)
	)
		return true;

	return false;
}

const IGNORABLE_RESOLVE_ERRORS = new Set([
	'ERR_MODULE_NOT_FOUND',
	'ERR_PACKAGE_PATH_NOT_EXPORTED', // This is a problem with the node_module itself
]);

let cachedTsConfigPathKeys: string[] | null | undefined;

function isMatchInTsConfigPaths(specifier: string): boolean {
	const keys = getTsConfigPathKeys();
	if (!keys?.length) return false;

	for (const key of keys) {
		const star = key.indexOf('*');
		if (star === -1) {
			if (specifier === key) return true;
			continue;
		}

		const prefix = key.slice(0, star);
		const suffix = key.slice(star + 1);
		if (
			specifier.startsWith(prefix) &&
			(!suffix || specifier.endsWith(suffix))
		) {
			return true;
		}
	}

	return false;
}

function getTsConfigPathKeys(): string[] | null {
	if (cachedTsConfigPathKeys !== undefined) return cachedTsConfigPathKeys;

	try {
		const raw = readFileSync(
			resolvePath(process.cwd(), 'tsconfig.json'),
			'utf8',
		);
		const withoutComments = raw
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/(^|[^:])\/\/.*$/gm, '$1');
		const withoutTrailingCommas = withoutComments.replace(/,\s*([}\]])/g, '$1');
		const parsed = JSON.parse(withoutTrailingCommas) as {
			compilerOptions?: { paths?: Record<string, string[]> };
		};

		cachedTsConfigPathKeys = Object.keys(parsed.compilerOptions?.paths ?? {});
		return cachedTsConfigPathKeys;
	} catch {
		cachedTsConfigPathKeys = null;
		return cachedTsConfigPathKeys;
	}
}

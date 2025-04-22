import { isBuiltin } from 'node:module';
import { extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { jsExts, tsExts } from './exts.ts';
import type { FSAbsolutePath, ResolvedSpecifier, Specifier } from './index.d.ts';
import { resolvesToNodeModule } from './resolves-to-node-module.ts';
import { getNotFoundUrl } from './get-not-found-url.ts';

/**
 * Whether the specifier can be completely ignored.
 * @param parentPath The module containing the provided specifier
 * @param specifier The specifier to check.
 */
export function isIgnorableSpecifier(parentPath: FSAbsolutePath, specifier: string) {
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
	if (specifier.startsWith('file://')) return false;

	let resolvedSpecifier: ResolvedSpecifier;
	try {
		resolvedSpecifier = import.meta.resolve(
			specifier,
			pathToFileURL(parentPath).href,
		) as ResolvedSpecifier; // [1]
	} catch (err) {
		if (
			!(err instanceof Error)
			|| !IGNORABLE_RESOLVE_ERRORS.has((err as NodeJS.ErrnoException).code!)
		)
			throw err;

		resolvedSpecifier = getNotFoundUrl(err);
	} finally {
		/* biome-ignore lint/correctness/noUnsafeFinally: This does not blindly override the control
		flow the rule is meant to protect */
		if (resolvesToNodeModule(resolvedSpecifier!, parentPath, specifier)) return true;
	}

	return false;
}

const IGNORABLE_RESOLVE_ERRORS = new Set([
	'ERR_MODULE_NOT_FOUND',
	'ERR_PACKAGE_PATH_NOT_EXPORTED', // This is a problem with the node_module itself
]);

// [1] The second argument of `import.meta.resolve()` requires `--experimental-import-meta-resolve`

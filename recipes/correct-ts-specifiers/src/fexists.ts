import { access, constants } from 'node:fs/promises';

import type {
	FSAbsolutePath,
	ResolvedSpecifier,
	Specifier,
} from './index.d.ts';
import { resolveSpecifier } from './resolve-specifier.ts';

export function fexists(
	parentPath: FSAbsolutePath | ResolvedSpecifier,
	specifier: Specifier,
) {
	let resolvedSpecifier;
	try {
		resolvedSpecifier = resolveSpecifier(parentPath, specifier) as FSAbsolutePath;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== 'ERR_MODULE_NOT_FOUND') throw err;
		return false;
	}

	return fexistsResolved(resolvedSpecifier);
}

export const fexistsResolved = (resolvedSpecifier: FSAbsolutePath) =>
	access(resolvedSpecifier, constants.F_OK).then(
		() => true,
		() => false,
	);

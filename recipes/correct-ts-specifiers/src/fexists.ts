// biome-ignore lint/style/useNodejsImportProtocol: JSSG runtime resolves 'fs' for this codemod.
import { constants, promises as fs } from 'fs';

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
	let resolvedSpecifier: FSAbsolutePath;
	try {
		resolvedSpecifier = resolveSpecifier(
			parentPath,
			specifier,
		) as FSAbsolutePath;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== 'ERR_MODULE_NOT_FOUND')
			throw err;
		return false;
	}

	return fexistsResolved(resolvedSpecifier);
}

export const fexistsResolved = (resolvedSpecifier: FSAbsolutePath) =>
	fs.access(resolvedSpecifier, constants.F_OK).then(
		() => true,
		() => false,
	);

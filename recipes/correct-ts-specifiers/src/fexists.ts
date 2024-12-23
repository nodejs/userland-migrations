import { access, constants } from 'node:fs/promises';

import type {
	FSAbsolutePath,
	ResolvedSpecifier,
	Specifier,
} from './types.ts';
import { resolveSpecifier } from './resolve-specifier.ts';

export function fexists(
	parentPath: FSAbsolutePath | ResolvedSpecifier,
	specifier: Specifier,
) {
	const resolvedSpecifier = resolveSpecifier(parentPath, specifier) as FSAbsolutePath;

	return fexistsResolved(resolvedSpecifier);
}

export const fexistsResolved = (resolvedSpecifier: FSAbsolutePath) =>
	access(resolvedSpecifier, constants.F_OK).then(
		() => true,
		() => false,
	);

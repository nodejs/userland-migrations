import { lstat } from 'node:fs/promises';

import type { FSAbsolutePath, NodeError, ResolvedSpecifier, Specifier } from './index.d.ts';
import { resolveSpecifier } from './resolve-specifier.ts';

export async function isDir(parentPath: FSAbsolutePath | ResolvedSpecifier, specifier: Specifier) {
	let resolvedSpecifier: ResolvedSpecifier;
	try {
		resolvedSpecifier = resolveSpecifier(parentPath, specifier);
	} catch (err) {
		if ((err as NodeError).code === 'ERR_MODULE_NOT_FOUND') return null;
	}

	try {
		const stat = await lstat(resolvedSpecifier!);
		return stat.isDirectory();
	} catch (err) {
		return null;
	}
}

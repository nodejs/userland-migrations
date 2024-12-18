import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { FSAbsolutePath, ResolvedSpecifier } from './index.d.ts';

export function resolvesToNodeModule(
	resolvedUrl: ResolvedSpecifier,
	parentLocus: FSAbsolutePath | ResolvedSpecifier,
) {
	if (!URL.canParse(resolvedUrl)) throw new TypeError('resolvedUrl must be a file url string');

	const parentUrl = isAbsolute(parentLocus) ? pathToFileURL(parentLocus).href : parentLocus;

	let i = 0; // Track the last common character to determine where to check for a node module.
	for (let n = resolvedUrl.length; i < n; i++) if (resolvedUrl[i] !== parentUrl[i]) break;

	// The first segment of rest of the resolved url needs to exactly match 'node_module' (it could be
	// something like 'fake_node_modules') to be a real node module dependency.
	return resolvedUrl.slice(i).split('/')[0] === 'node_modules';
}

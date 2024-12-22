import { pathToFileURL } from 'node:url';

import type { FSAbsolutePath, ResolvedSpecifier } from './index.d.ts';

export const getNotFoundUrl = (err: NodeJS.ErrnoException & { url?: FSAbsolutePath }) =>
	pathToFileURL(err?.url ?? err.message.split("'")[1])?.href as ResolvedSpecifier;

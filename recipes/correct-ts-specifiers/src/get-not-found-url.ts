import { pathToFileURL } from 'node:url';

import type { NodeError, ResolvedSpecifier } from './index.d.ts';

export const getNotFoundUrl = (err: NodeError) =>
	pathToFileURL(err?.url ?? err.message.split("'")[1])?.href as ResolvedSpecifier;

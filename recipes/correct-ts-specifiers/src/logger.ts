import type { FSAbsolutePath, ResolvedSpecifier } from './index.d.ts';

type LogLevel = 'warn' | 'error';

export function logger(
	parentPath: FSAbsolutePath | ResolvedSpecifier,
	level: LogLevel,
	message: string,
) {
	console[level](`[correct-ts-specifiers] ${parentPath}: ${message}`);
}

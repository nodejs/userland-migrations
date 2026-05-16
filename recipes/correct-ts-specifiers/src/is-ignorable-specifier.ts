import { isBuiltin } from 'node:module';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { jsExts, tsExts } from './exts.ts';
import type { FSAbsolutePath } from './index.d.ts';

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
	if (specifier.startsWith('node:')) return true;
	if (specifier.startsWith('data:')) return true;

	const ext = extname(specifier);
	// @ts-expect-error
	if (tsExts.includes(ext)) return true;
	// @ts-expect-error
	if (jsExts.includes(ext)) return false;
	if (ext) return true; // There is an extension and it's not TS or suspect

	if (specifier[0] === '@') return true; // namespaced node module

	if (specifier.startsWith('/')) return false;
	if (specifier.startsWith('./')) return false;
	if (specifier.startsWith('..')) return false;
	if (specifier.startsWith('file://')) return false;
	if (isMatchInTsConfigPaths(specifier)) return false;
	if (specifier.startsWith('#')) return true;

	return resolvesAsNodeModule(parentPath, specifier);
}

let cachedTsConfigPathKeys: string[] | null | undefined;

function isMatchInTsConfigPaths(specifier: string): boolean {
	const keys = getTsConfigPathKeys();
	if (!keys?.length) return false;

	for (const key of keys) {
		if (key === '*') continue;

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

function resolvesAsNodeModule(parentPath: FSAbsolutePath, specifier: string): boolean {
	try {
		const require = createRequire(pathToFileURL(parentPath));
		require.resolve(specifier);
		return true;
	} catch {
		return hasNodeModulePackage(parentPath, specifier);
	}
}

function hasNodeModulePackage(parentPath: FSAbsolutePath, specifier: string): boolean {
	const packageName = extractPackageName(specifier);
	if (!packageName) return false;

	let current = dirname(parentPath);
	let previous = '';

	while (current !== previous) {
		if (fileExists(join(current, 'node_modules', packageName, 'package.json')))
			return true;

		previous = current;
		current = dirname(current);
	}

	return false;
}

function extractPackageName(specifier: string): string | null {
	if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('#')) {
		return null;
	}

	const segments = specifier.split('/');
	if (!segments[0]) return null;

	if (segments[0].startsWith('@')) {
		if (segments.length < 2 || !segments[1]) return null;
		return `${segments[0]}/${segments[1]}`;
	}

	return segments[0];
}

function fileExists(path: string): boolean {
	try {
		readFileSync(path);
		return true;
	} catch {
		return false;
	}
}

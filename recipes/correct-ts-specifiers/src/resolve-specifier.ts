import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { isAbsolute } from 'node:path';
import { resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type {
	FSAbsolutePath,
	NodeModSpecifier,
	ResolvedSpecifier,
	Specifier,
} from './index.d.ts';
import { getNotFoundUrl } from './get-not-found-url.ts';
import { resolvesToNodeModule } from './resolves-to-node-module.ts';

/**
 * Determine the fully resolved module location indicated by the specifier.
 * @param parentPath The module containing the provided specifier.
 * @param specifier The specifier to potentially correct.
 */
export function resolveSpecifier(
	parentPath: FSAbsolutePath | ResolvedSpecifier,
	specifier: Specifier,
): FSAbsolutePath | NodeModSpecifier {
	if (URL.canParse(specifier))
		return fileURLToPath(specifier) as FSAbsolutePath;

	const importMetaResolve = (
		import.meta as { resolve?: (specifier: string, parent?: string) => string }
	).resolve;
	if (typeof importMetaResolve !== 'function') {
		return resolveWithoutImportMeta(parentPath, specifier);
	}

	// import.meta.resolve() gives access to node's resolution algorithm, which is necessary to handle
	// a myriad of non-obvious routes, like pjson subimports and the result of any hooks that may be
	// helping, such as ones facilitating tsconfig's "paths".
	let resolvedSpecifierUrl: URL['href'] | undefined;
	const parentUrl = (
		isAbsolute(parentPath) ? pathToFileURL(parentPath).href : parentPath
	) as ResolvedSpecifier;

	try {
		const interimResolvedUrl = importMetaResolve(
			specifier,
			parentUrl,
		) as ResolvedSpecifier;

		if (resolvesToNodeModule(interimResolvedUrl, parentUrl, specifier))
			return specifier as NodeModSpecifier;

		resolvedSpecifierUrl = interimResolvedUrl; //! let continue to `fileURLToPath` below
	} catch (err) {
		if (!(err instanceof Error)) throw err;

		const tsConfigResolved = resolveViaTsConfigPaths(specifier);
		if (tsConfigResolved) {
			resolvedSpecifierUrl = tsConfigResolved;
		} else if (
			(err as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND' &&
			resolvesToNodeModule(getNotFoundUrl(err), parentUrl, specifier)
		) {
			return specifier as NodeModSpecifier;
		}

		if (!resolvedSpecifierUrl) {
			Error.captureStackTrace(err);
			Object.assign(err, { specifier, parentPath });
			throw err;
		}
	}

	if (!resolvedSpecifierUrl?.startsWith('file://')) return specifier;

	return fileURLToPath(resolvedSpecifierUrl) as FSAbsolutePath;
}

function resolveWithoutImportMeta(
	parentPath: FSAbsolutePath | ResolvedSpecifier,
	specifier: Specifier,
): FSAbsolutePath | NodeModSpecifier {
	if (isAbsolute(specifier)) return specifier as FSAbsolutePath;

	if (specifier.startsWith('./') || specifier.startsWith('../')) {
		const parentFsPath = isAbsolute(parentPath)
			? parentPath
			: (fileURLToPath(parentPath) as FSAbsolutePath);
		const resolved = resolvePath(dirname(parentFsPath), specifier);
		return resolved as FSAbsolutePath;
	}

	const packageImportResolved = resolveViaPackageImports(specifier);
	if (packageImportResolved) {
		return fileURLToPath(packageImportResolved) as FSAbsolutePath;
	}

	const tsConfigResolved = resolveViaTsConfigPaths(specifier);
	if (tsConfigResolved) {
		return fileURLToPath(tsConfigResolved) as FSAbsolutePath;
	}

	return specifier as NodeModSpecifier;
}

type TsConfigPathMap = {
	keyPrefix: string;
	keySuffix: string;
	targetPrefix: string;
	targetSuffix: string;
};

type TsConfigPaths = {
	baseDir: string;
	entries: TsConfigPathMap[];
};

let cachedTsConfigPaths: TsConfigPaths | null | undefined;
let cachedPackageImports: Record<string, string> | null | undefined;

function resolveViaTsConfigPaths(
	specifier: Specifier,
): ResolvedSpecifier | null {
	if (
		specifier.startsWith('.') ||
		specifier.startsWith('/') ||
		specifier.startsWith('#')
	) {
		return null;
	}

	const tsConfigPaths = getTsConfigPaths();
	if (!tsConfigPaths) return null;

	for (const entry of tsConfigPaths.entries) {
		const matched = matchPathPattern(
			specifier,
			entry.keyPrefix,
			entry.keySuffix,
			entry.targetPrefix,
			entry.targetSuffix,
		);

		if (!matched) continue;

		const absolutePath = isAbsolute(matched)
			? matched
			: resolvePath(tsConfigPaths.baseDir, matched);

		return pathToFileURL(absolutePath).href as ResolvedSpecifier;
	}

	return null;
}

function getTsConfigPaths(): TsConfigPaths | null {
	if (cachedTsConfigPaths !== undefined) return cachedTsConfigPaths;

	try {
		const raw = readFileSync(
			resolvePath(process.cwd(), 'tsconfig.json'),
			'utf8',
		);
		const json = parseJsonc(raw) as {
			compilerOptions?: {
				baseUrl?: string;
				paths?: Record<string, string[]>;
			};
		};

		const paths = json.compilerOptions?.paths;
		if (!paths) {
			cachedTsConfigPaths = null;
			return cachedTsConfigPaths;
		}

		const baseDir = resolvePath(
			process.cwd(),
			json.compilerOptions?.baseUrl ?? '.',
		);
		const entries: TsConfigPathMap[] = [];

		for (const [pattern, targets] of Object.entries(paths)) {
			if (!targets.length) continue;

			const firstTarget = targets[0];
			const [keyPrefix, keySuffix] = splitStarPattern(pattern);
			const [targetPrefix, targetSuffix] = splitStarPattern(firstTarget);

			entries.push({ keyPrefix, keySuffix, targetPrefix, targetSuffix });
		}

		cachedTsConfigPaths = { baseDir, entries };
		return cachedTsConfigPaths;
	} catch {
		cachedTsConfigPaths = null;
		return cachedTsConfigPaths;
	}
}

function resolveViaPackageImports(
	specifier: Specifier,
): ResolvedSpecifier | null {
	if (!specifier.startsWith('#')) return null;

	const imports = getPackageImports();
	if (!imports) return null;

	const direct = imports[specifier];
	if (direct) {
		const resolved = resolvePath(process.cwd(), direct);
		return pathToFileURL(resolved).href as ResolvedSpecifier;
	}

	for (const [key, target] of Object.entries(imports)) {
		const [keyPrefix, keySuffix] = splitStarPattern(key);
		const [targetPrefix, targetSuffix] = splitStarPattern(target);
		const matched = matchPathPattern(
			specifier,
			keyPrefix,
			keySuffix,
			targetPrefix,
			targetSuffix,
		);

		if (!matched) continue;

		const resolved = resolvePath(process.cwd(), matched);
		return pathToFileURL(resolved).href as ResolvedSpecifier;
	}

	return null;
}

function getPackageImports(): Record<string, string> | null {
	if (cachedPackageImports !== undefined) return cachedPackageImports;

	try {
		const raw = readFileSync(
			resolvePath(process.cwd(), 'package.json'),
			'utf8',
		);
		const parsed = JSON.parse(raw) as { imports?: Record<string, string> };
		cachedPackageImports = parsed.imports ?? null;
		return cachedPackageImports;
	} catch {
		cachedPackageImports = null;
		return cachedPackageImports;
	}
}

function parseJsonc(content: string): unknown {
	const withoutComments = content
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/(^|[^:])\/\/.*$/gm, '$1');
	const withoutTrailingCommas = withoutComments.replace(/,\s*([}\]])/g, '$1');
	return JSON.parse(withoutTrailingCommas);
}

function splitStarPattern(pattern: string): [string, string] {
	const star = pattern.indexOf('*');
	if (star === -1) return [pattern, ''];
	return [pattern.slice(0, star), pattern.slice(star + 1)];
}

function matchPathPattern(
	value: string,
	keyPrefix: string,
	keySuffix: string,
	targetPrefix: string,
	targetSuffix: string,
): string | null {
	if (!value.startsWith(keyPrefix)) return null;
	if (keySuffix && !value.endsWith(keySuffix)) return null;

	const wildcardValue = value.slice(
		keyPrefix.length,
		value.length - keySuffix.length,
	);
	return `${targetPrefix}${wildcardValue}${targetSuffix}`;
}

import assert from 'node:assert/strict';
import { type Mock, before, describe, it, mock } from 'node:test';

type LStat = typeof import('node:fs/promises').lstat;
type ResolveSpecifier = typeof import('./is-dir.ts').isDir;
type IsDir = typeof import('./resolve-specifier.ts').resolveSpecifier;

describe('Is a directory', () => {
	let mock_lstat: Mock<LStat>['mock'];
	let mock_resolveSpecifier: Mock<ResolveSpecifier>['mock'];
	let isDir: IsDir;

	const base = '/tmp';
	const specifier = './foo.ts';
	const parent = `${base}/test.ts`;
	const resolvedPath = `/${base}/foo.ts`;

	before(async () => {
		const lstat = mock.fn<IsDir>();
		const resolveSpecifier = mock.fn<ResolveSpecifier>();
		mock_lstat = lstat.mock;
		mock_resolveSpecifier = resolveSpecifier.mock;

		mock.module('node:fs/promises', { namedExports: { lstat } });
		mock.module('./resolve-specifier.ts', { namedExports: { resolveSpecifier } });

		({ isDir } = await import('./is-dir.ts'));
	});

	it('should try to resolve an unresolved specifier', async () => {
		mock_resolveSpecifier.mockImplementationOnce(
			// @ts-ignore
			function mock_resolveSpecifier() {
				return resolvedPath;
			},
		);

		await isDir(parent, specifier);

		assert.equal(mock_lstat.calls[0].arguments[0], resolvedPath);
	});

	it('should ignore unrelated errors', async () => {
		mock_resolveSpecifier.mockImplementationOnce(
			// @ts-ignore
			function mock_resolveSpecifier() {
				const err = Object.assign(new Error(), { code: 'ERR_OTHER' });
				throw err;
			},
		);

		await isDir(parent, specifier);

		assert.equal(mock_lstat.calls[0].arguments[0], resolvedPath);
	});

	it('should signal `null` when the specifier is unresolvable or cannot be found', async () => {
		mock_resolveSpecifier.mockImplementationOnce(
			// @ts-ignore
			function mock_resolveSpecifier() {
				const err = Object.assign(new Error(), { code: 'ERR_MODULE_NOT_FOUND' });
				throw err;
			},
		);

		assert.equal(await isDir(parent, specifier), null);
	});

	it('should signal `false` when the specifier is NOT a directory', async () => {
		mock_lstat.mockImplementationOnce(function mock_lstat() {
			return {
				isDirectory() {
					return false;
				},
			};
		});

		assert.equal(await isDir(parent, specifier), false);
	});

	it('should signal `true` when the specifier IS a directory', async () => {
		mock_lstat.mockImplementationOnce(function mock_lstat() {
			return {
				isDirectory() {
					return true;
				},
			};
		});

		assert.equal(await isDir(parent, specifier), true);
	});
});

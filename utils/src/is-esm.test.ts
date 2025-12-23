import { afterEach, beforeEach, describe, it } from 'node:test';
import {
	writeFileSync,
	unlinkSync,
	existsSync,
	mkdtempSync,
	rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import isESM from './is-esm.ts';
import type { SgRoot } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';
import assert from 'node:assert/strict';

const createMockRoot = (filename, hasImport = false, hasRequire = false) => {
	return {
		filename: () => filename,
		root: () => ({
			find: ({ rule }) => {
				if (rule.kind === 'import_statement') {
					return hasImport ? ['mock-import-node'] : null;
				}
				if (rule.kind === 'call_expression' && rule.has?.regex === 'require') {
					return hasRequire ? ['mock-require-node'] : null;
				}
				return [];
			},
		}),
		// biome-ignore lint/suspicious/noExplicitAny: it's a mock
	} as any as SgRoot<JS>;
};

describe('isESM', () => {
	let originalCwd: string;
	let tempDir: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		tempDir = mkdtempSync(join(tmpdir(), 'is-esm-test'));
		process.chdir(tempDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe('File extension detection', () => {
		it('should return true for .mjs files regardless of content', async () => {
			const mockRoot = createMockRoot('test.mjs', false, true);
			const result = isESM(mockRoot);
			assert.strictEqual(result, true);
		});

		it('should return true for .mts files regardless of content', async () => {
			const mockRoot = createMockRoot('test.mts', false, true);
			const result = isESM(mockRoot);
			assert.strictEqual(result, true);
		});

		it('should return false for .cjs files regardless of content', async () => {
			const mockRoot = createMockRoot('test.cjs', true, false);
			const result = isESM(mockRoot);
			assert.strictEqual(result, false);
		});

		it('should return false for .cts files regardless of content', async () => {
			const mockRoot = createMockRoot('test.cts', true, false);
			const result = isESM(mockRoot);
			assert.strictEqual(result, false);
		});
	});

	describe('Import/require detection', () => {
		it('should return true when file has import statements', async () => {
			const mockRoot = createMockRoot('test.js', true, false);
			const result = isESM(mockRoot);
			assert.strictEqual(result, true);
		});

		it('should return false when file has require statements', async () => {
			const mockRoot = createMockRoot('test.js', false, true);
			const result = isESM(mockRoot);
			assert.strictEqual(result, false);
		});

		it('should prioritize import over require if both exist (edge case)', async () => {
			const mockRoot = createMockRoot('test.js', true, true);
			const result = isESM(mockRoot);
			assert.strictEqual(result, true);
		});

		it('should prioritize file extension over import/require detection', async () => {
			// .mjs with require should still be true
			const mockRoot1 = createMockRoot('test.mjs', false, true);
			const result1 = isESM(mockRoot1);
			assert.strictEqual(result1, true);

			// .cjs with import should still be false
			const mockRoot2 = createMockRoot('test.cjs', true, false);
			const result2 = isESM(mockRoot2);
			assert.strictEqual(result2, false);
		});
	});

	describe('package.json type detection', () => {
		it('should return true when package.json has type: "module"', async () => {
			writeFileSync(
				join(tempDir, 'package.json'),
				JSON.stringify({ type: 'module' }),
			);

			const mockRoot = createMockRoot('test.js', false, false);
			const result = isESM(mockRoot);
			assert.strictEqual(result, true);
		});

		it('should return false when package.json has no type field', async () => {
			writeFileSync(
				join(tempDir, 'package.json'),
				JSON.stringify({ name: 'test-package' }),
			);

			const mockRoot = createMockRoot('test.js', false, false);
			const result = isESM(mockRoot);
			assert.strictEqual(result, false);
		});

		it('should return false when package.json has type: "commonjs"', async () => {
			writeFileSync(
				join(tempDir, 'package.json'),
				JSON.stringify({ type: 'commonjs' }),
			);

			const mockRoot = createMockRoot('test.js', false, false);
			const result = isESM(mockRoot);
			assert.strictEqual(result, false);
		});

		it('should return false when package.json has other type value', async () => {
			writeFileSync(
				join(tempDir, 'package.json'),
				JSON.stringify({ type: 'custom' }),
			);

			const mockRoot = createMockRoot('test.js', false, false);
			const result = isESM(mockRoot);
			assert.strictEqual(result, false);
		});

		it('should throw error when package.json does not exist', async () => {
			const packageJsonPath = join(tempDir, 'package.json');
			if (existsSync(packageJsonPath)) {
				unlinkSync(packageJsonPath);
			}

			const mockRoot = createMockRoot('test.js', false, false);

			assert.throws(() => isESM(mockRoot), {
				name: 'Error',
				message: /ENOENT|no such file or directory/,
			});
		});
	});
});

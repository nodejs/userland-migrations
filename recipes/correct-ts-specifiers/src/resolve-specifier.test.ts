import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import type { FSAbsolutePath } from './index.d.ts';
import { resolveSpecifier } from './resolve-specifier.ts';

describe('Resolve specifier', () => {
	const fixturesDir = path.join(import.meta.dirname, 'fixtures/e2e') as FSAbsolutePath;
	const catSpecifier = `${fixturesDir}/Cat.ts` as FSAbsolutePath;

	it('should strip an already resolved specifier (file url → path)', () => {
		const resolvedSpecifier = resolveSpecifier(`${fixturesDir}/test.ts`, `file://${catSpecifier}`);

		assert.equal(resolvedSpecifier, catSpecifier);
	});

	describe('node modules', () => {
		it('should ignore a bare specifier', () => {
			const resolvedSpecifier = resolveSpecifier(catSpecifier, 'animal-features');

			assert.equal(resolvedSpecifier, 'animal-features');
		});

		it('should ignore a non-suspect bare specifier subimport', () => {
			const ogSpecifier = 'foo/bar';
			const resolvedSpecifier = resolveSpecifier(catSpecifier, ogSpecifier);

			assert.equal(resolvedSpecifier, ogSpecifier);
		});
	});

	describe('own modules', () => {
		it('should resolve and return a file path', () => {
			const resolvedSpecifier = resolveSpecifier(`${fixturesDir}/test.ts`, './Cat.ts');

			assert.equal(resolvedSpecifier, catSpecifier);
		});
	});
});

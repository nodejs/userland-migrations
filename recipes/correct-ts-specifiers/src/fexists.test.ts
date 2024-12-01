import assert from 'node:assert/strict';
import { type Mock, afterEach, before, describe, it, mock } from 'node:test';
import { fileURLToPath } from 'node:url';

import type { FSAbsolutePath } from './index.d.ts';

type FSAccess = typeof import('node:fs/promises').access;
type FExists = typeof import('./fexists.ts').fexists;
type ResolveSpecifier = typeof import('./resolve-specifier.ts').resolveSpecifier;

const RESOLVED_SPECIFIER_ERR = 'Resolved specifier did not match expected';

describe('fexists', () => {
	const parentPath = '/tmp/test.ts';
	const constants = { F_OK: null };

	let mock__access: Mock<FSAccess>['mock'];
	let mock__resolveSpecifier: Mock<ResolveSpecifier>['mock'];

	before(() => {
		const access = mock.fn<FSAccess>();
		({ mock: mock__access } = access);
		mock.module('node:fs/promises', {
			namedExports: {
				access,
				constants,
			},
		});

		const resolveSpecifier = mock.fn<ResolveSpecifier>();
		({ mock: mock__resolveSpecifier } = resolveSpecifier);
		mock.module('./resolve-specifier.ts', {
			namedExports: {
				resolveSpecifier,
			},
		});
		mock__resolveSpecifier.mockImplementation(function MOCK__resolveSpecifier(pp, specifier) {
			return specifier;
		});
	});

	describe('when the file exists', () => {
		let fexists: FExists;

		before(async () => {
			mock__access.mockImplementation(async function MOCK_access() {});

			({ fexists } = await import('./fexists.ts'));
		});

		afterEach(() => {
			mock__access.resetCalls();
		});

		it('should return `true` for a bare specifier', async () => {
			const specifier = 'foo';
			const parentUrl = fileURLToPath(
				import.meta.resolve('./fixtures/e2e/test.js'),
			) as FSAbsolutePath;

			assert.equal(await fexists(parentUrl, specifier), true);
			assert.equal(mock__access.calls[0].arguments[0], specifier, RESOLVED_SPECIFIER_ERR);
		});

		it('should return `true` for a relative specifier', async () => {
			const specifier = 'exists.js';
			assert.equal(await fexists(parentPath, specifier), true);
			assert.equal(mock__access.calls[0].arguments[0], specifier, RESOLVED_SPECIFIER_ERR);
		});

		it('should return `true` for specifier with a query parameter', async () => {
			const specifier = 'exists.js?v=1';
			assert.equal(await fexists(parentPath, specifier), true);
			assert.equal(mock__access.calls[0].arguments[0], specifier, RESOLVED_SPECIFIER_ERR);
		});

		it('should return `true` for an absolute specifier', async () => {
			assert.equal(await fexists(parentPath, '/tmp/foo/exists.js'), true);
			assert.equal(
				mock__access.calls[0].arguments[0],
				'/tmp/foo/exists.js',
				RESOLVED_SPECIFIER_ERR,
			);
		});

		it('should return `true` for a URL', async () => {
			assert.equal(await fexists(parentPath, 'file://localhost/foo/exists.js'), true);
			assert.equal(
				mock__access.calls[0].arguments[0],
				'file://localhost/foo/exists.js',
				RESOLVED_SPECIFIER_ERR,
			);
		});
	});

	describe('when the file does NOT exists', () => {
		let fexists: FExists;

		before(async () => {
			mock__access.mockImplementation(async function MOCK_access() {
				throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
			});

			({ fexists } = await import('./fexists.ts'));
		});

		afterEach(() => {
			mock__access.resetCalls();
		});

		it('should return `false` for a relative specifier', async () => {
			const specifier = 'noexists.js';
			assert.equal(await fexists(parentPath, specifier), false);
			assert.equal(mock__access.calls[0].arguments[0], specifier, RESOLVED_SPECIFIER_ERR);
		});

		it('should return `false` for a relative specifier', async () => {
			const specifier = 'noexists.js?v=1';
			assert.equal(await fexists(parentPath, specifier), false);
			assert.equal(mock__access.calls[0].arguments[0], specifier, RESOLVED_SPECIFIER_ERR);
		});

		it('should return `false` for an absolute specifier', async () => {
			const specifier = '/tmp/foo/noexists.js';
			assert.equal(await fexists(parentPath, specifier), false);
			assert.equal(mock__access.calls[0].arguments[0], specifier, RESOLVED_SPECIFIER_ERR);
		});

		it('should return `false` for a URL specifier', async () => {
			const specifier = 'file://localhost/foo/noexists.js';
			assert.equal(await fexists(parentPath, specifier), false);
			assert.equal(mock__access.calls[0].arguments[0], specifier, RESOLVED_SPECIFIER_ERR);
		});
	});
});

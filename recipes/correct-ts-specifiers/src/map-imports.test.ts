import assert from 'node:assert/strict';
import { type Mock, before, describe, it, mock, afterEach } from 'node:test';
import { fileURLToPath } from 'node:url';

import { dExts } from './exts.ts';
import type { FSAbsolutePath } from './index.d.ts';


type Logger = typeof import('@nodejs/utils/logger').default;
type MapImports = typeof import('./map-imports.ts').mapImports;

describe('Map Imports', { concurrency: true }, () => {
	const originatingFilePath = fileURLToPath(import.meta.resolve('./test.ts')) as FSAbsolutePath;
	let mock__log: Mock<Logger['error']>['mock'];
	let mapImports: MapImports;

	before(async () => {
		const errorMock = mock.fn<Logger['error']>();
		const logger = {
			error: errorMock,
			warn: mock.fn<Logger['warn']>(),
			info: mock.fn<Logger['info']>(),
			debug: mock.fn<Logger['debug']>()
		};
		mock__log = errorMock.mock;
		mock.module('@nodejs/utils/logger', {
			defaultExport: logger,
		});

		({ mapImports } = await import('./map-imports.ts'));
	});

	afterEach(() => {
		mock__log.resetCalls();
	});

	it('unambiguous: should skip a node builtin specifier', async () => {
		const output = await mapImports(originatingFilePath, 'node:console');

		assert.equal(output.replacement, undefined);
		assert.notEqual(output.isType, true);
	});

	it('quasi-ambiguous: should append a JS extension when path resolves to a file', async () => {
		const specifier = './fixtures/bar';
		const output = await mapImports(originatingFilePath, specifier);

		assert.equal(output.replacement, `${specifier}.js`);
		assert.notEqual(output.isType, true);
	});

	it('quasi-ambiguous: should append a TS extension when path resolves to a file', async () => {
		const specifier = './fixtures/foo';
		const output = await mapImports(originatingFilePath, specifier);

		assert.equal(output.replacement, `${specifier}.ts`);
		assert.notEqual(output.isType, true);
	});

	it('unambiguous: should replace ".js" → ".ts" when JS file does NOT exist & TS file DOES exist', async () => {
		const specifier = './fixtures/noexist.js';
		const output = await mapImports(originatingFilePath, specifier);

		assert.equal(output.replacement, undefined);
		assert.notEqual(output.isType, true);

		assert.equal(mock__log.calls.length, 1, 'Expected exactly one error log call');
		const [errorMessage] = mock__log.calls[0].arguments as [string];

		assert.match(errorMessage, new RegExp(originatingFilePath));
		assert.match(errorMessage, /No matching file found/i);
		assert.match(errorMessage, new RegExp(specifier));
	});

	it('unambiguous: should not change the file extension when JS file DOES exist & TS file does NOT exist', async () => {
		const specifier = './fixtures/bar.js';
		const output = await mapImports(originatingFilePath, specifier);

		assert.equal(output.replacement, undefined);
		assert.notEqual(output.isType, true);
	});

	it('unambiguous: should replace ".js" → ".d…" when JS file does NOT exist & a declaration file exists', async () => {
		for (const dExt of dExts) {
			const extType = dExt.split('.').pop();
			const specifierBase = `./fixtures/d/unambiguous/${extType}/index`;
			const output = await mapImports(originatingFilePath, `${specifierBase}.js`);

			assert.equal(output.replacement, `${specifierBase}${dExt}`);
			assert.equal(output.isType, true);
		}
	});

	it('ambiguous: should log and skip when both a JS & a TS file exist with the same name', async () => {
		const output = await mapImports(originatingFilePath, './fixtures/foo.js');

		assert.equal(output.replacement, './fixtures/foo.ts');
		assert.notEqual(output.isType, true);
	});
});

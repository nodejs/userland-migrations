import assert from 'node:assert/strict';
import { type Mock, before, describe, it, mock, afterEach } from 'node:test';
import { fileURLToPath } from 'node:url';

import { dExts } from './exts.ts';
import type { FSAbsolutePath } from './index.d.ts';

type LoggerFunction = typeof import('@nodejs/codemod-utils/logger').logger;
type MapImports = typeof import('./map-imports.ts').mapImports;

describe('Map Imports', { concurrency: true }, () => {
	const originatingFilePath = fileURLToPath(import.meta.resolve('./test.ts')) as FSAbsolutePath;
	let mock__logger: Mock<LoggerFunction>;
	let mapImports: MapImports;

	before(async () => {
		const logger = mock.fn<LoggerFunction>();
		const setCodemodName = mock.fn();

		mock__logger = logger;

		mock.module('@nodejs/codemod-utils/logger', {
			defaultExport: { logger, setCodemodName },
		});

		({ mapImports } = await import('./map-imports.ts'));
	});

	afterEach(() => {
		mock__logger.mock.resetCalls();
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

		const { 0: source, 1: type, 2: message } = mock__logger.mock.calls[0].arguments;

		assert.equal(source, originatingFilePath);
		assert.equal(type, 'error');
		assert.match(message, /no match/i);
		assert.match(message, new RegExp(specifier));
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

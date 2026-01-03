import assert from 'node:assert';
import { describe, it } from 'node:test';
import astGrep from '@ast-grep/napi';
import dedent from 'dedent';
import { getModuleDependencies } from './module-dependencies.ts';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import type { SgRoot } from '@codemod.com/jssg-types/main';

describe('import-statement', () => {
	const code = dedent`
		import fs from 'fs';
		const fs = require('fs');
		const variable = 'node:tls'
		import(variable).then(console.log);
		import * as test from 'test'
	`;
	const ast = astGrep.parse<Js>(astGrep.Lang.JavaScript, code) as SgRoot<Js>;

	it('should return two fs dependencies', () => {
		const fsImports = getModuleDependencies(ast, 'fs');
		assert.equal(2, fsImports.length);
	});

	it('should return import that use variable', () => {
		const tlsImport = getModuleDependencies(ast, 'tls');
		assert.equal(1, tlsImport.length);
	});

	it('should return default import ', () => {
		const testImports = getModuleDependencies(ast, 'test');
		assert.equal(1, testImports.length);
	});
});

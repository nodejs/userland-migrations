import assert from "node:assert/strict";
import { describe, it } from "node:test";
import astGrep from '@ast-grep/napi';
import dedent from 'dedent';
import { getNodeImportStatements } from "./import-statement.ts";

describe("import-statement", () => {
	const code = dedent`
		import fs from 'fs';
		import { join } from 'node:path';
		import { spawn } from "child_process";
		import { styleText } from "node:util";
	`;
	const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

	it("should return import statements", () => {
		const fsImports = getNodeImportStatements(ast, 'fs');
		assert.strictEqual(fsImports.length, 1);
		assert.strictEqual(fsImports[0].field('source')?.text(), "'fs'");

		const pathImports = getNodeImportStatements(ast, 'path');
		assert.strictEqual(pathImports.length, 1);
		assert.strictEqual(pathImports[0].field('source')?.text(), "'node:path'");

		const childProcessImports = getNodeImportStatements(ast, 'child_process');
		assert.strictEqual(childProcessImports.length, 1);
		assert.strictEqual(childProcessImports[0].field('source')?.text(), '"child_process"');

		const utilImports = getNodeImportStatements(ast, 'util');
		assert.strictEqual(utilImports.length, 1);
		assert.strictEqual(utilImports[0].field('source')?.text(), '"node:util"');
	});
});

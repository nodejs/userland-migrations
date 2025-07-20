import assert from "node:assert/strict";
import { describe, it } from "node:test";
import astGrep from '@ast-grep/napi';
import dedent from 'dedent';
import {
	getNodeImportStatements,
	getNodeImportCalls,
	isImportStatementSpread
} from "./import-statement.ts";

describe("import-statement", () => {
	it("should return import statements", () => {
		const code = dedent`
			import fs from 'fs';
			import { join } from 'node:path';
			import { spawn } from "child_process";
			import { styleText } from "node:util";
			import defaultExport from "module-a";
			import * as namespace from "module-b";
			import { named1, named2 as alias } from "module-c";
			import "module-d";
			import "";
			import config from "./config.json" assert { type: "json" };
			import {} from "module-e";
		`;
		const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

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

	it("should return import calls", () => {
		const code = dedent`
			const fs = await import('fs');
			var { join } = await import('node:path');
			let { spawn } = await import("child_process");
			const { styleText } = await import("node:util");
			await import("no:assignment");
			await import(variable);
			await import(\`backticks\`);
			import("no:assignment");
			import(variable);
			import(\`backticks\`);
		`;
		const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

		const fsCalls = getNodeImportCalls(ast, 'fs');
		assert.strictEqual(fsCalls.length, 1);
		const fsCallExpr = fsCalls[0].field('value')?.children()[1]; // await_expression -> call_expression
		assert.strictEqual(fsCallExpr?.field('function')?.text(), 'import');
		assert.strictEqual(fsCallExpr?.field('arguments')?.find({ rule: { kind: "string" } })?.text(), "'fs'");

		const pathCalls = getNodeImportCalls(ast, 'path');
		assert.strictEqual(pathCalls.length, 1);
		const pathCallExpr = pathCalls[0].field('value')?.children()[1]; // await_expression -> call_expression
		assert.strictEqual(pathCallExpr?.field('function')?.text(), 'import');
		assert.strictEqual(pathCallExpr?.field('arguments')?.find({ rule: { kind: "string" } })?.text(), "'node:path'");

		const childProcessCalls = getNodeImportCalls(ast, 'child_process');
		assert.strictEqual(childProcessCalls.length, 1);
		const childProcessCallExpr = childProcessCalls[0].field('value')?.children()[1]; // await_expression -> call_expression
		assert.strictEqual(childProcessCallExpr?.field('function')?.text(), 'import');
		assert.strictEqual(childProcessCallExpr?.field('arguments')?.find({ rule: { kind: "string" } })?.text(), '"child_process"');

		const utilCalls = getNodeImportCalls(ast, 'util');
		assert.strictEqual(utilCalls.length, 1);
		const utilCallExpr = utilCalls[0].field('value')?.children()[1]; // await_expression -> call_expression
		assert.strictEqual(utilCallExpr?.field('function')?.text(), 'import');
		assert.strictEqual(utilCallExpr?.field('arguments')?.find({ rule: { kind: "string" } })?.text(), '"node:util"');
	});

	it("shouldn't catch pending promises during import calls", () => {
		const code = dedent`
			const pending = import("node:module");
		`;
		const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

		const moduleCalls = getNodeImportCalls(ast, 'module');
		assert.strictEqual(moduleCalls.length, 0, "Pending import calls should not be caught");
	});

	it("should correctly identify spread import statements", () => {
		const testCases = [
			{ code: 'import { readFile } from "fs";', expected: true, description: 'Named import' },
			{ code: 'import { readFile as read } from "fs";', expected: true, description: 'Named import with alias' },
			{ code: 'import * as fs from "fs";', expected: false, description: 'Namespace import' },
			{ code: 'import fs from "fs";', expected: false, description: 'Default import' },
			{ code: 'import {} from "fs";', expected: true, description: 'Empty named import' },
			{ code: 'import { a, b, c } from "module";', expected: true, description: 'Multiple named imports' },
			{ code: 'import { a as x, b, c as y } from "module";', expected: true, description: 'Mixed named imports with aliases' },
			{ code: 'import "side-effect";', expected: false, description: 'Side-effect import' }
		];

		for( const testCase of testCases) {
			const ast = astGrep.parse(astGrep.Lang.JavaScript, testCase.code);
			const importNode = ast.root().find({ rule: { kind: 'import_statement' } });

			assert.ok(importNode, `Could not find import statement for: ${testCase.code}`);

			const result = isImportStatementSpread(importNode);

			assert.strictEqual(
				result,
				testCase.expected,
				`${testCase.description}: Expected ${testCase.expected} for "${testCase.code}", got ${result}`
			);
		}
	});
})

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import astGrep from '@ast-grep/napi';
import dedent from 'dedent';
import { getNodeRequireCalls, isSpreadRequire } from "./require-call.ts";

describe("require-call", () => {
	const code = dedent`
		const fs = require('fs');
		var { join } = require('node:path');
		let { spawn } = require("child_process");
		const { styleText } = require("node:util");
		require("no:assignment");
		require(variable);
		require(\`backticks\`);
	`;
	const ast = astGrep.parse(astGrep.Lang.JavaScript, code);


	it("should return require calls", () => {
		const fsRequires = getNodeRequireCalls(ast, 'fs');
		assert.strictEqual(fsRequires.length, 1);
		assert.strictEqual(fsRequires[0].field('value')?.text(), "require('fs')");

		const pathRequires = getNodeRequireCalls(ast, 'path');
		assert.strictEqual(pathRequires.length, 1);
		assert.strictEqual(pathRequires[0].field('value')?.text(), "require('node:path')");

		const childProcessRequires = getNodeRequireCalls(ast, 'child_process');
		assert.strictEqual(childProcessRequires.length, 1);
		assert.strictEqual(childProcessRequires[0].field('value')?.text(), 'require("child_process")');

		const utilRequires = getNodeRequireCalls(ast, 'util');
		assert.strictEqual(utilRequires.length, 1);
		assert.strictEqual(utilRequires[0].field('value')?.text(), 'require("node:util")');
	});

	it("should correctly identify spread require statements", () => {
		const testCases = [
			{ code: 'const { readFile } = require("fs");', expected: true, description: 'Named require (destructured)' },
			{ code: 'const { readFile: read } = require("fs");', expected: true, description: 'Named require with alias' },
			{ code: 'const fs = require("fs");', expected: false, description: 'Simple require assignment' },
			{ code: 'const {} = require("fs");', expected: true, description: 'Empty destructured require' },
			{ code: 'const { a, b, c } = require("module");', expected: true, description: 'Multiple destructured requires' },
			{ code: 'var { join, resolve } = require("path");', expected: true, description: 'var with destructuring' },
			{ code: 'let util = require("util");', expected: false, description: 'let with simple assignment' },
		];

		testCases.forEach((testCase) => {
			const ast = astGrep.parse(astGrep.Lang.JavaScript, testCase.code);
			const varDeclarator = ast.root().find({ rule: { kind: 'variable_declarator' } });

			assert.ok(varDeclarator, `Could not find variable_declarator for: ${testCase.code}`);

			const result = isSpreadRequire(varDeclarator);
			assert.strictEqual(
				result,
				testCase.expected,
				`${testCase.description}: Expected ${testCase.expected} for "${testCase.code}", got ${result}`
			);
		});
	});
});

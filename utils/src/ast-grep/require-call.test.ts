import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import astGrep from '@ast-grep/napi';
import dedent from 'dedent';
import { getNodeRequireCalls } from './require-call.ts';

describe('require-call', () => {
	const code = dedent`
		const fs = require('fs');
		var { join } = require('node:path');
		let { spawn } = require("child_process");
		const { styleText } = require("node:util");
		require("no:assignment");
		require(variable);
		require(\`backticks\`);
		const cpus = require("node:os").cpus;
	`;
	const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

	it('should return require calls', () => {
		const fsRequires = getNodeRequireCalls(ast, 'fs');
		assert.strictEqual(fsRequires.length, 1);
		assert.strictEqual(fsRequires[0].field('value')?.text(), "require('fs')");

		const pathRequires = getNodeRequireCalls(ast, 'path');
		assert.strictEqual(pathRequires.length, 1);
		assert.strictEqual(
			pathRequires[0].field('value')?.text(),
			"require('node:path')",
		);

		const childProcessRequires = getNodeRequireCalls(ast, 'child_process');
		assert.strictEqual(childProcessRequires.length, 1);
		assert.strictEqual(
			childProcessRequires[0].field('value')?.text(),
			'require("child_process")',
		);

		const utilRequires = getNodeRequireCalls(ast, 'util');
		assert.strictEqual(utilRequires.length, 1);
		assert.strictEqual(
			utilRequires[0].field('value')?.text(),
			'require("node:util")',
		);

		const osRequires = getNodeRequireCalls(ast, 'os');
		assert.strictEqual(osRequires.length, 1);
		assert.strictEqual(
			osRequires[0].field('value')?.text(),
			'require("node:os").cpus',
		);
	});
});

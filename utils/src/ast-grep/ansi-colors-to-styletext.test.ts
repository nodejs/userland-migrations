import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import astGrep from '@ast-grep/napi';
import dedent from 'dedent';
import process from 'node:process';
import transform from './ansi-colors-to-styletext.ts';

function runTransform(code: string) {
	const ast = astGrep.parse(astGrep.Lang.JavaScript, code);
	return transform(ast);
}

describe('ansi-colors-to-styletext', () => {
	it('should transform CommonJS require statements', () => {
		const code = dedent`
			const ac = require('ansi-colors');
			console.log(ac.red('text'));
		`;

		const result = runTransform(code);

		assert.strictEqual(
			result,
			dedent`
				const { styleText } = require('node:util');
				console.log(styleText('red', 'text'));
			`,
		);
	});

	it('should transform ES module imports', () => {
		const code = dedent`
			import ac from 'ansi-colors';
			console.log(ac.red('text'));
		`;

		const result = runTransform(code);

		assert.strictEqual(
			result,
			dedent`
				import { styleText } from 'node:util';
				console.log(styleText('red', 'text'));
			`,
		);
	});

	it('should transform namespace imports', () => {
		const code = dedent`
			import * as ac from 'ansi-colors';
			console.log(ac.bold.red('text'));
		`;

		const result = runTransform(code);

		assert.strictEqual(
			result,
			dedent`
				import { styleText } from 'node:util';
				console.log(styleText(['bold', 'red'], 'text'));
			`,
		);
	});

	it('should transform dynamic imports', () => {
		const code = dedent`
			const ac = await import('ansi-colors');
			console.log(ac.red('text'));
		`;

		const result = runTransform(code);

		assert.strictEqual(
			result,
			dedent`
				const { styleText } = await import('node:util');
				console.log(styleText('red', 'text'));
			`,
		);
	});

	it('should transform simple style calls', () => {
		const code = dedent`
			const ac = require('ansi-colors');
			const output = ac.green('hello');
		`;

		const result = runTransform(code);

		assert.strictEqual(
			result,
			dedent`
				const { styleText } = require('node:util');
				const output = styleText('green', 'hello');
			`,
		);
	});

	it('should transform chained style calls', () => {
		const code = dedent`
			const ac = require('ansi-colors');
			const output = ac.bold.red('hello');
		`;

		const result = runTransform(code);

		assert.strictEqual(
			result,
			dedent`
				const { styleText } = require('node:util');
				const output = styleText(['bold', 'red'], 'hello');
			`,
		);
	});

	it('should warn and skip unsupported ansi-colors APIs', () => {
		const code = dedent`
			const ac = require('ansi-colors');
			if (true) {
				ac.enabled;
				console.log(ac.red('hello'));
			}
		`;

		const warnings: string[] = [];
		const originalWrite = process.stderr.write;
		process.stderr.write = ((chunk: unknown) => {
			warnings.push(String(chunk));
			return true;
		}) as typeof process.stderr.write;

		try {
			const result = runTransform(code);
			assert.strictEqual(
				result,
				dedent`
					const { styleText } = require('node:util');
					if (true) {
						ac.enabled;
						console.log(ac.red('hello'));
					}
				`,
			);
			assert.equal(warnings.length, 1);
			assert.match(
				warnings[0],
				/uses ansi-colors API 'enabled' that does not have any equivalent in util\.styleText please review this line/,
			);
		} finally {
			process.stderr.write = originalWrite;
		};
	});

	it('should warn and skip nested unsupported ansi-colors APIs', () => {
		const code = dedent`
			const ac = require('ansi-colors');
			function demo() {
				ac.bold.visible('hello');
			}
			console.log(ac.red('outside'));
		`;

		const warnings: string[] = [];
		const originalWrite = process.stderr.write;
		process.stderr.write = ((chunk: unknown) => {
			warnings.push(String(chunk));
			return true;
		}) as typeof process.stderr.write;

		try {
			const result = runTransform(code);
			assert.strictEqual(
				result,
				dedent`
					const { styleText } = require('node:util');
					function demo() {
						ac.bold.visible('hello');
					}
					console.log(styleText('red', 'outside'));
				`,
			);
			assert.equal(warnings.length, 1);
			assert.match(
				warnings[0],
				/uses ansi-colors API 'visible' that does not have any equivalent in util\.styleText please review this line/,
			);
		} finally {
			process.stderr.write = originalWrite;
		};
	});
});
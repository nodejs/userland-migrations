import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import astGrep from '@ast-grep/napi';
import dedent from 'dedent';
import { getShebang, replaceNodeJsArgs } from './shebang.ts';

describe('shebang', () => {
	describe('getShebang', () => {
		it('should get the shebang line', () => {
			const code = dedent`
				#!/usr/bin/env node
				console.log("Hello, world!");
			`;
			const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

			const shebang = getShebang(ast);

			assert.ok(shebang);
			assert.equal(shebang.text(), '#!/usr/bin/env node');
		});

		it('should take the last shebang line if multiple exist on top of the code', () => {
			const code = dedent`
				#!/usr/bin/env node 1
				#!/usr/bin/env node 2
				console.log("Hello, world!");
			`;
			const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

			const shebang = getShebang(ast);

			assert.strictEqual(shebang?.text(), '#!/usr/bin/env node 2');
		});

		it('should return null if no shebang line', () => {
			const code = dedent`
				console.log("Hello, world!");
			`;

			const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

			const shebang = getShebang(ast);
			assert.strictEqual(shebang, null);
		});

		it("shouldn't catch shebangs in comments", () => {
			const code = dedent`
				// #!/usr/bin/env node
				console.log("Hello, world!");
			`;
			const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

			const shebang = getShebang(ast);

			assert.strictEqual(shebang, null);
		});

		it("shouldn't catch shebang in middle of code", () => {
			const code = dedent`
				console.log("Hello, world!");
				#!/usr/bin/env node
			`;
			const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

			const shebang = getShebang(ast);

			assert.strictEqual(shebang, null);
		});
	});

	describe('replaceNodeJsArgs', () => {
		it('should replace multiple different arguments in shebang with overlapping names', () => {
			const code = dedent`
				#!/usr/bin/env node --foo --foobar --bar
				console.log("Hello, world!");
			`;
			const ast = astGrep.parse(astGrep.Lang.JavaScript, code);
			const edits = replaceNodeJsArgs(ast, {
				'--foo': '--baz',
				'--bar': '--qux',
			});

			assert.strictEqual(edits.length, 2);
			assert.strictEqual(
				edits[0].insertedText,
				'#!/usr/bin/env node --baz --foobar --bar',
			);
			assert.strictEqual(
				edits[1].insertedText,
				'#!/usr/bin/env node --baz --foobar --qux',
			);
		});

		it('should not replace arguments that are substrings of other args', () => {
			const code = dedent`
				#!/usr/bin/env node --foo --foo-bar --bar
				console.log("Hello, world!");
			`;
			const ast = astGrep.parse(astGrep.Lang.JavaScript, code);
			const edits = replaceNodeJsArgs(ast, {
				'--foo': '--baz',
				'--bar': '--qux',
			});

			assert.strictEqual(edits.length, 2);
			assert.strictEqual(
				edits[0].insertedText,
				'#!/usr/bin/env node --baz --foo-bar --bar',
			);
			assert.strictEqual(
				edits[1].insertedText,
				'#!/usr/bin/env node --baz --foo-bar --qux',
			);
		});

		it('should handle shebang with multiple spaces between args', () => {
			const code = dedent`
				#!/usr/bin/env node   --foo    --bar
				console.log("Hello, world!");
			`;
			const ast = astGrep.parse(astGrep.Lang.JavaScript, code);
			const edits = replaceNodeJsArgs(ast, {
				'--foo': '--baz',
				'--bar': '--qux',
			});

			assert.strictEqual(edits.length, 2);
			assert.strictEqual(
				edits[0].insertedText,
				'#!/usr/bin/env node   --baz    --bar',
			);
			assert.strictEqual(
				edits[1].insertedText,
				'#!/usr/bin/env node   --baz    --qux',
			);
		});

		it('should not replace if argument is at the start of the shebang', () => {
			const code = dedent`
				#!/usr/bin/env --foo node --bar
				console.log("Hello, world!");
			`;
			const ast = astGrep.parse(astGrep.Lang.JavaScript, code);
			const edits = replaceNodeJsArgs(ast, { '--foo': '--baz' });

			// Should not replace because node must be present
			assert.strictEqual(edits.length, 0);
		});

		it('should replace argument with special characters', () => {
			const code = dedent`
				#!/usr/bin/env node --foo-bar --bar_foo
				console.log("Hello, world!");
			`;
			const ast = astGrep.parse(astGrep.Lang.JavaScript, code);
			const edits = replaceNodeJsArgs(ast, {
				'--foo-bar': '--baz-bar',
				'--bar_foo': '--qux_foo',
			});

			assert.strictEqual(edits.length, 2);
			assert.strictEqual(
				edits[0].insertedText,
				'#!/usr/bin/env node --baz-bar --bar_foo',
			);
			assert.strictEqual(
				edits[1].insertedText,
				'#!/usr/bin/env node --baz-bar --qux_foo',
			);
		});

		it('should not replace anything if argsToValues is empty', () => {
			const code = dedent`
				#!/usr/bin/env node --foo --bar
				console.log("Hello, world!");
			`;
			const ast = astGrep.parse(astGrep.Lang.JavaScript, code);
			const edits = replaceNodeJsArgs(ast, {});

			assert.strictEqual(edits.length, 0);
		});

		it('should handle shebang with quoted arguments', () => {
			const code = dedent`
				#!/usr/bin/env node "--foo" '--bar'
				console.log("Hello, world!");
			`;
			const ast = astGrep.parse(astGrep.Lang.JavaScript, code);
			const edits = replaceNodeJsArgs(ast, {
				'"--foo"': '"--baz"',
				"'--bar'": "'--qux'",
			});

			assert.strictEqual(edits.length, 2);
			assert.strictEqual(
				edits[0].insertedText,
				'#!/usr/bin/env node "--baz" \'--bar\'',
			);
			assert.strictEqual(
				edits[1].insertedText,
				'#!/usr/bin/env node "--baz" \'--qux\'',
			);
		});
	});
});

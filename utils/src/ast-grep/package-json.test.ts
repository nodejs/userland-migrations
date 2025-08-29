import assert from "node:assert/strict";
import { describe, it } from "node:test";
import dedent from "dedent";
import jsonLang from "@ast-grep/lang-json";
import { registerDynamicLanguage, parse } from "@ast-grep/napi";
import type { Edit } from "@ast-grep/napi";
import { getScriptsNode, getNodeJsUsage, replaceNodeJsArgs } from "./package-json.ts";

registerDynamicLanguage({ json: jsonLang });

describe("package-json utilities", () => {
	describe("getScriptsNode", () => {
		it("should get the scripts node", () => {
			const input = dedent`
				{
					"scripts": {
						"test": "echo \\"Error: no test specified\\" && exit 1"
					}
				}
			`;

			const result = getScriptsNode(parse('json', input));

			assert(result);
			assert.strictEqual(result.children().length, 3); // curly braces + pair + curly braces
		});

		it("should return empty array if any scripts is present", () => {
			const input = dedent`
				{
					"name": "example-package",
					"version": "1.0.0"
				}
			`;

			const result = getNodeJsUsage(parse('json', input));

			assert.strictEqual(result.length, 0);
		});

		it("should throw an error if multiple scripts nodes are found", () => {
			const input = dedent`
				{
					"scripts": {
						"test": "echo \\"Error: no test specified\\" && exit 1"
					},
					"scripts": {
						"start": "node index.js"
					}
				}
			`;

			assert.throws(() => getScriptsNode(parse('json', input)), {
				message: /Multiple "scripts" fields found/
			});
		});
	});

	describe("getNodeJsUsage", () => {
		it("should get Node.js usage in scripts", () => {
			const input = dedent`
				{
					"scripts": {
						"start": "node script.js",
						"test": "echo \\"Error: no test specified\\" && exit 1"
					}
				}
			`;

			const result = getNodeJsUsage(parse('json', input));

			assert.strictEqual(result.length, 1);
			assert.strictEqual(result[0].text(), "node script.js");
		});

		it("should not catch `node_modules`", () => {
			const input = dedent`
				{
					"scripts": {
						"start": "node_modules/.bin/some-tool",
						"test": "node another-script.js"
					}
				}
			`;

			const result = getNodeJsUsage(parse('json', input));

			assert.strictEqual(result.length, 1);
			assert.strictEqual(result[0].text(), "node another-script.js");
		});

		it("should return empty array if no Node.js usage is found", () => {
			const input = dedent`
				{
					"scripts": {
						"start": "npm run build",
						"test": "echo \\"Error: no test specified\\" && exit 1"
					}
				}
			`;

			const result = getNodeJsUsage(parse('json', input));

			assert.strictEqual(result.length, 0);
		});
	});

	describe("replaceNodeJsArgs", () => {
		it("should replace Node.js arguments in scripts", () => {
			const input = dedent`
				{
					"scripts": {
						"start": "node --experimental-foo script.js",
					}
				}
			`;

			const edits: Edit[] = [];
			replaceNodeJsArgs(parse('json', input), { '--experimental-foo': '--experimental-bar' }, edits);

			assert.strictEqual(edits.length, 1);
			assert.strictEqual(edits[0].insertedText, 'node --experimental-bar script.js');
		});

		it("should not replace an arg that contains same", () => {
			const input = dedent`
				{
					"scripts": {
						"start": "node --experimental-foo-prop script.js",
					}
				}
			`;

			const edits: Edit[] = [];
			replaceNodeJsArgs(parse('json', input), { '--experimental-foo': '--experimental-bar' }, edits);

			assert.strictEqual(edits.length, 0);
		});


		it("should handle multiple replacements", () => {
			const input = dedent`
				{
					"scripts": {
						"start": "node --experimental-foo script.js",
						"test": "node --experimental-foo script.js"
					}
				}
			`;

			const edits: Edit[] = [];
			replaceNodeJsArgs(parse('json', input), { '--experimental-foo': '--experimental-bar' }, edits);

			assert.strictEqual(edits.length, 2);
			assert.strictEqual(edits[0].insertedText, 'node --experimental-bar script.js');
			assert.strictEqual(edits[1].insertedText, 'node --experimental-bar script.js');
		});
	});
});

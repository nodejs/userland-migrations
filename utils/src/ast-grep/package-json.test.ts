import assert from "node:assert/strict";
import { describe, it } from "node:test";
import dedent from "dedent";
import { parse } from "@ast-grep/napi";
import type { Edit, SgRoot } from "@codemod.com/jssg-types/main";
import {
	getScriptsNode,
	getNodeJsUsage,
	replaceNodeJsArgs,
	removeNodeJsArgs
} from "./package-json.ts";

describe("package-json utilities", () => {
	describe("getScriptsNode", () => {
		it("should get the scripts node", () => {
			const input = dedent`
				{
					"scripts": {
						"test": "echo \"Error: no test specified\" && exit 1"
					}
				}
			`;

			const result = getScriptsNode(parse('json', input) as SgRoot);

			assert(result);
			assert.strictEqual(result.length, 1); // Number of children in the scripts node
		});

		it("should return empty array if any scripts is present", () => {
			const input = dedent`
				{
					"name": "example-package",
					"version": "1.0.0"
				}
			`;

			const result = getNodeJsUsage(parse('json', input) as SgRoot);

			assert.strictEqual(result.length, 0);
		});
	});

	describe("getNodeJsUsage", () => {
		it("should get Node.js usage in scripts", () => {
			const input = dedent`
				{
					"scripts": {
						"start": "node script.js",
						"test": "echo \"Error: no test specified\" && exit 1"
					}
				}
			`;

			const result = getNodeJsUsage(parse('json', input) as SgRoot);

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

			const result = getNodeJsUsage(parse('json', input) as SgRoot);

			assert.strictEqual(result.length, 1);
			assert.strictEqual(result[0].text(), "node another-script.js");

	describe("removeNodeJsArgs", () => {
		it("should remove a single Node.js arg in scripts", () => {
			const input = dedent`
				{
					"scripts": {
						"start": "node --trace-deprecation app.js"
					}
				}
			`;
			const root = parse('json', input) as SgRoot;
			const edits: Edit[] = [];
			removeNodeJsArgs(root, ["--trace-deprecation"], edits);
			assert.strictEqual(edits.length, 1);
		});

		it("should remove multiple args in one command", () => {
			const input = dedent`
				{
					"scripts": {
						"start": "node --foo --bar app.js"
					}
				}
			`;
			const root = parse('json', input) as SgRoot;
			const edits: Edit[] = [];
			removeNodeJsArgs(root, ["--foo", "--bar"], edits);
			assert.strictEqual(edits.length, 2);
		});

		it("should handle node.exe commands too", () => {
			const input = dedent`
				{
					"scripts": {
						"start": "node.exe --flag app.js"
					}
				}
			`;
			const root = parse('json', input) as SgRoot;
			const edits: Edit[] = [];
			removeNodeJsArgs(root, ["--flag"], edits);
			assert.strictEqual(edits.length, 1);
		});

		it("should ignore scripts that do not use node (e.g., node_modules bins)", () => {
			const input = dedent`
				{
					"scripts": {
						"start": "node_modules/.bin/some-tool",
						"test": "node script.js"
					}
				}
			`;
			const root = parse('json', input) as SgRoot;
			const edits: Edit[] = [];
			removeNodeJsArgs(root, ["script.js"], edits);
			assert.strictEqual(edits.length, 1);
		});

		it("should be a no-op when no args match", () => {
			const input = dedent`
				{
					"scripts": {
						"start": "node app.js"
					}
				}
			`;
			const root = parse('json', input) as SgRoot;
			const edits: Edit[] = [];
			removeNodeJsArgs(root, ["--not-present"], edits);
			assert.strictEqual(edits.length, 0);
		});
	});
		});

		it("should catch `node.exe`", () => {
			const input = dedent`
				{
					"scripts": {
						"start": "node.exe script.js",
						"test": "echo \"Error: no test specified\" && exit 1"
					}
				}
			`;

			const result = getNodeJsUsage(parse('json', input) as SgRoot);

			assert.strictEqual(result.length, 1);
			assert.strictEqual(result[0].text(), "node.exe script.js");
		});

		it("should return empty array if no Node.js usage is found", () => {
			const input = dedent`
				{
					"scripts": {
						"start": "npm run build",
						"test": "echo \"Error: no test specified\" && exit 1"
					}
				}
			`;

			const result = getNodeJsUsage(parse('json', input) as SgRoot);

			assert.strictEqual(result.length, 0);
		});

		it("should not catch node in the key", () => {
			const input = dedent`
				{
					"scripts": {
						"node": "echo \"foo\""
					}
				}
			`;

			const result = getNodeJsUsage(parse('json', input) as SgRoot);

			assert.strictEqual(result.length, 0);
		});
	});

	describe("replaceNodeJsArgs", () => {
		it("should replace a single Node.js arg in scripts", () => {
			const input = dedent`
				{
					"scripts": {
						"start": "node --trace-deprecation app.js"
					}
				}
			`;

			const root = parse('json', input) as SgRoot;
			const edits: Edit[] = [];
			replaceNodeJsArgs(root, { "--trace-deprecation": "--trace-warnings" }, edits);
			assert.strictEqual(edits.length, 1);
		});

		it("should replace multiple args in one command", () => {
			const input = dedent`
				{
					"scripts": {
						"start": "node --foo --bar app.js"
					}
				}
			`;

			const root = parse('json', input) as SgRoot;
			const edits: Edit[] = [];
			replaceNodeJsArgs(root, { "--foo": "--x", "--bar": "--y" }, edits);
			assert.strictEqual(edits.length, 2);
		});

		it("should handle node.exe commands too", () => {
			const input = dedent`
				{
					"scripts": {
						"start": "node.exe --flag app.js"
					}
				}
			`;

			const root = parse('json', input) as SgRoot;
			const edits: Edit[] = [];
			replaceNodeJsArgs(root, { "--flag": "--replaced" }, edits);
			assert.strictEqual(edits.length, 1);
		});

		it("should ignore scripts that do not use node (e.g., node_modules bins)", () => {
			const input = dedent`
				{
					"scripts": {
						"start": "node_modules/.bin/some-tool",
						"test": "node script.js"
					}
				}
			`;

			const root = parse('json', input) as SgRoot;
			const edits: Edit[] = [];
			replaceNodeJsArgs(root, { "script.js": "index.js" }, edits);
			assert.strictEqual(edits.length, 1);
		});

		it("should be a no-op when no args match", () => {
			const input = dedent`
				{
					"scripts": {
						"start": "node app.js"
					}
				}
			`;

			const root = parse('json', input)as SgRoot;
			const edits: Edit[] = [];

			replaceNodeJsArgs(root, { "--not-present": "--new" }, edits);

			assert.strictEqual(edits.length, 0);
		});
	});
});

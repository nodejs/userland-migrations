import assert from "node:assert/strict";
import { describe, it } from "node:test";
import dedent from "dedent";
import { removeLines } from "./remove-lines.ts";
import type { Range } from "@ast-grep/napi/types/sgnode.js";

describe("remove-lines", () => {
	it("should return the entire file", () => {
		const code = dedent`
			line 1
			line 2
			line 3
			line 4
		`;

		const output = removeLines(code, []);

		assert.strictEqual(code, output);
	});

	it("should return the file without the line two", () => {
		const code = dedent`
			line 1
			line 2
			line 3
			line 4
		`;

		const expected = dedent`
			line 1
			line 3
			line 4
		`;

		const range = {
			start: {
				row: 1,
			},
			end: {
				row: 1,
			},
		};

		const output = removeLines(code, [range]);

		assert.strictEqual(expected, output);
	});

	it("should receive two different ranges and remove correct lines", () => {
		const code = dedent`
			line 1
			line 2
			line 3
			line 4
		`;

		const expected = dedent`
			line 1
			line 4
		`;

		const removeLineTwo = {
			start: {
				row: 1,
			},
			end: {
				row: 1,
			},
		} as Range;

		const removeLineThree: Range = {
			start: {
				row: 2,
			},
			end: {
				row: 2,
			},
		} as Range;

		// @ts-ignore - @ast-grep/napi  need a fix on the
		const output = removeLines(code, [removeLineTwo, removeLineThree]);

		assert.strictEqual(expected, output);
	});

	it("should an range that remove multiple lines and return the correct code", () => {
		const code = dedent`
			line 1
			line 2
			line 3
			line 4
		`;

		const expected = dedent`
			line 1
			line 4
		`;

		const range: Range = {
			start: {
				row: 1,
			},
			end: {
				row: 2,
			},
		} as Range;

		const output = removeLines(code, [range]);

		assert.strictEqual(expected, output);
	});
});

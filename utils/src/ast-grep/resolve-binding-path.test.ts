import assert from "node:assert/strict";
import { describe, it } from "node:test";
import astGrep from "@ast-grep/napi";
import dedent from "dedent";

import { resolveBindingPath } from "./resolve-binding-path.ts";

describe("resolve-binding-path", () => {
	it("should be able to solve binding path to simple requires", () => {
		const code = dedent`
			const util = require('node:util');
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const importStatement = rootNode.root().find({
			rule: {
				kind: "lexical_declaration",
			},
		});

		const bindingPath = resolveBindingPath(importStatement!, "$.types.isNativeError");

		assert.strictEqual(bindingPath, "util.types.isNativeError");
	});

	it("should be able to solve binding path when destructuring happen", () => {
		const code = dedent`
			const { types } = require('node:util');
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const importStatement = rootNode.root().find({
			rule: {
				kind: "variable_declarator",
			},
		});

		const bindingPath = resolveBindingPath(importStatement!, "$.types.isNativeError");

		assert.strictEqual(bindingPath, "types.isNativeError");
	});

	it("should be able to solve binding when have multiple destructurings", () => {
		const code = dedent`
			const { types: { isNativeError } } = require('node:util');
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const importStatement = rootNode.root().find({
			rule: {
				kind: "variable_declarator",
			},
		});

		const bindingPath = resolveBindingPath(importStatement!, "$.types.isNativeError");

		assert.strictEqual(bindingPath, "isNativeError");
	});

	it("should be able to solve binding when a rename happen", () => {
		const code = dedent`
			const { types: typesRenamed } = require('node:util');
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const importStatement = rootNode.root().find({
			rule: {
				kind: "variable_declarator",
			},
		});

		const bindingPath = resolveBindingPath(importStatement!, "$.types.isNativeError");

		assert.strictEqual(bindingPath, "typesRenamed.isNativeError");
	});

	it("should throw an error if unsupported node kind is passed", () => {
		const code = dedent`
			function test() { }
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const functionDeclaration = rootNode.root().find({
			rule: {
				kind: "function_declaration",
			},
		});

		assert.throws(() => resolveBindingPath(functionDeclaration!, "$.types.isNativeError"));
	});

	it("should be able to solve binding using esmodule with default import", () => {
		const code = dedent`
			import util from 'node:util';
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const importStatement = rootNode.root().find({
			rule: {
				kind: "import_statement",
			},
		});

		const bindingPath = resolveBindingPath(importStatement!, "$.types.isNativeError");

		assert.strictEqual(bindingPath, "util.types.isNativeError");
	});

	it("should be able to solve binding using esmodule with named imports", () => {
		const code = dedent`
			import { types } from 'node:util';
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const importStatement = rootNode.root().find({
			rule: {
				kind: "import_statement",
			},
		});

		const bindingPath = resolveBindingPath(importStatement!, "$.types.isNativeError");

		assert.strictEqual(bindingPath, "types.isNativeError");
	});

	it("should be able to solve binding using esmodule with named imports using alias", () => {
		const code = dedent`
			import { types as renamedTypes } from 'node:util';
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const importStatement = rootNode.root().find({
			rule: {
				kind: "import_statement",
			},
		});

		const bindingPath = resolveBindingPath(importStatement!, "$.types.isNativeError");

		assert.strictEqual(bindingPath, "renamedTypes.isNativeError");
	});

	it("should be able to solve binding using esmodule with namespace import", () => {
		const code = dedent`
			import * as example from 'node:util';
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const importStatement = rootNode.root().find({
			rule: {
				kind: "import_statement",
			},
		});

		const bindingPath = resolveBindingPath(importStatement!, "$.types.isNativeError");

		assert.strictEqual(bindingPath, "example.types.isNativeError");
	});
});

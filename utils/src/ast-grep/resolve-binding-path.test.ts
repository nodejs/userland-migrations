import assert from "node:assert/strict";
import { describe, it } from "node:test";
import astGrep from "@ast-grep/napi";
import dedent from "dedent";
import type Js from "@codemod.com/jssg-types/langs/javascript";
import type { SgNode } from "@codemod.com/jssg-types/main";

import { resolveBindingPath } from "./resolve-binding-path.ts";

describe("resolve-binding-path", () => {
	it("should be able to solve binding path to simple requires", () => {
		const code = dedent`
			const util = require('node:util');
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const importStatement = (rootNode.root() as SgNode<Js>).find({
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
		const importStatement = (rootNode.root() as SgNode<Js>).find({
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
		const requireStatement = (rootNode.root() as SgNode<Js>).find({
			rule: {
				kind: "variable_declarator",
			},
		});

		const bindingPath = resolveBindingPath(requireStatement!, "$.types.isNativeError");

		assert.strictEqual(bindingPath, "isNativeError");
	});

	it("should be able to solve binding when a rename happen", () => {
		const code = dedent`
			const { types: typesRenamed } = require('node:util');
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const importStatement = (rootNode.root() as SgNode<Js>).find({
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
		const functionDeclaration = (rootNode.root() as SgNode<Js>).find({
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
		const importStatement = (rootNode.root() as SgNode<Js>).find({
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
		const importStatement = (rootNode.root() as SgNode<Js>).find({
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
		const importStatement = (rootNode.root() as SgNode<Js>).find({
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
		const importStatement = (rootNode.root() as SgNode<Js>).find({
			rule: {
				kind: "import_statement",
			},
		});

		const bindingPath = resolveBindingPath(importStatement!, "$.types.isNativeError");

		assert.strictEqual(bindingPath, "example.types.isNativeError");
	});

	it("should handle deep nested destructuring with multiple levels", () => {
		const code = dedent`
			const { types: { isNativeError: nativeErrorCheck } } = require('node:util');
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const requireStatement = (rootNode.root() as SgNode<Js>).find({
			rule: {
				kind: "variable_declarator",
			},
		});

		const bindingPath = resolveBindingPath(requireStatement!, "$.types.isNativeError");

		assert.strictEqual(bindingPath, "nativeErrorCheck");
	});

	it("generateshould handle complex path resolution with longer dotted paths", () => {
		const code = dedent`
			const util = require('node:util');
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const importStatement = (rootNode.root() as SgNode<Js>).find({
			rule: {
				kind: "lexical_declaration",
			},
		});

		const bindingPath = resolveBindingPath(importStatement!, "$.types.format.inspect.custom");

		assert.strictEqual(bindingPath, "util.types.format.inspect.custom");
	});

	it("should handle multiple named imports with different aliases", () => {
		const code = dedent`
			import { types as utilTypes, format as utilFormat } from 'node:util';
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const importStatement = (rootNode.root() as SgNode<Js>).find({
			rule: {
				kind: "import_statement",
			},
		});

		const bindingPath = resolveBindingPath(importStatement!, "$.format.inspect");

		assert.strictEqual(bindingPath, "utilFormat.inspect");
	});

	it("should handle require with complex destructuring and renaming", () => {
		const code = dedent`
			const { types: renamed, format: { inspect } } = require('node:util');
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const requireStatement = (rootNode.root() as SgNode<Js>).find({
			rule: {
				kind: "variable_declarator",
			},
		});

		const bindingPath = resolveBindingPath(requireStatement!, "$.types.isNativeError");

		assert.strictEqual(bindingPath, "renamed.isNativeError");
	});

	it("should handle deep destructuring and return remaining path after resolved binding", () => {
		const code = dedent`
			const { a: {b: { c: { d }} } } = require('node:util');
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const requireStatement = (rootNode.root() as SgNode<Js>).find({
			rule: {
				kind: "variable_declarator",
			},
		});

		const bindingPath = resolveBindingPath(requireStatement!, "$.a.b.c.d.e");

		assert.strictEqual(bindingPath, "d.e");
	});

	it("should handle single character variable names", () => {
		const code = dedent`
			const { types: t } = require('node:util');
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const requireStatement = (rootNode.root() as SgNode<Js>).find({
			rule: {
				kind: "variable_declarator",
			},
		});

		const bindingPath = resolveBindingPath(requireStatement!, "$.types.isNativeError");

		assert.strictEqual(bindingPath, "t.isNativeError");
	});

	it("should handle mixed require patterns with array destructuring context", () => {
		const code = dedent`
			const [, { types }] = [null, require('node:util')];
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);

		const requireStatement = (rootNode.root() as SgNode<Js>).find({
			rule: {
				kind: "variable_declarator",
			},
		});

		const bindingPath = resolveBindingPath(requireStatement!, "$.types.isNativeError");

		assert.strictEqual(bindingPath, "types.isNativeError");
	});

	it("should resolve correctly when have member-expression", () => {
		const code = dedent`
			const SlowBuffer = require('buffer').SlowBuffer;
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const requireStatement = (rootNode.root() as SgNode<Js>).find({
			rule: {
				kind: "variable_declarator",
			},
		});

		const bindingPath = resolveBindingPath(requireStatement!, "$.SlowBuffer");

		assert.strictEqual(bindingPath, "SlowBuffer");
	});

	it("should resolve correctly when there are multiple property accesses", () => {
		const code = dedent`
			const variable = require('buffer').a.b;
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const requireStatement = (rootNode.root() as SgNode<Js>).find({
			rule: {
				kind: "variable_declarator",
			},
		});

		const bindingPath = resolveBindingPath(requireStatement!, "$.a.b");

		assert.strictEqual(bindingPath, "variable");
	});

	it("should resolve correctly when there are multiple property accesses but not the entire path", () => {
		const code = dedent`
			const variable = require('buffer').a.b;
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const requireStatement = (rootNode.root() as SgNode<Js>).find({
			rule: {
				kind: "variable_declarator",
			},
		});

		const bindingPath = resolveBindingPath(requireStatement!, "$.a.b.c.d.e");

		assert.strictEqual(bindingPath, "variable.c.d.e");
	});

	it("should resolve correctly when there are multiple property accesses and destructuring", () => {
		const code = dedent`
			const { c: { d } } = require('buffer').a.b;
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const requireStatement = (rootNode.root() as SgNode<Js>).find({
			rule: {
				kind: "variable_declarator",
			},
		});

		const bindingPath = resolveBindingPath(requireStatement!, "$.a.b.c.d.e");

		assert.strictEqual(bindingPath, "d.e");
	});
});

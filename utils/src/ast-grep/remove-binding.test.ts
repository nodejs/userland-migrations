import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import astGrep from '@ast-grep/napi';
import dedent from 'dedent';
import { removeBinding } from './remove-binding.ts';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import type { SgNode } from '@codemod.com/jssg-types/main';

describe('remove-binding', () => {
	it('should remove the entire require statement when the only imported binding is removed', () => {
		const code = dedent`
			const util = require('node:util');
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const requireStatement = node.find({
			rule: {
				kind: 'lexical_declaration',
			},
		});

		const change = removeBinding(requireStatement!, 'util');

		assert.notEqual(change, null);
		assert.strictEqual(change?.edit, undefined);
		assert.deepEqual(change?.lineToRemove, {
			start: { line: 0, column: 0, index: 0 },
			end: { line: 0, column: 34, index: 34 },
		});
	});

	it('should return undefined when the binding does not match the imported name', () => {
		const code = dedent`
			const util = require('node:util');
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const requireStatement = node.find({
			rule: {
				kind: 'lexical_declaration',
			},
		});

		// line 12 it was imported as util, and here is passed types to be removed
		const change = removeBinding(requireStatement!, 'types');

		assert.equal(change, undefined);
	});

	it('should remove the entire require statement when removing the only named import', () => {
		const code = dedent`
			const { types } = require('node:util');
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const importStatement = node.find({
			rule: {
				kind: 'lexical_declaration',
			},
		});

		const change = removeBinding(importStatement!, 'types');

		assert.notEqual(change, null);
		assert.strictEqual(change?.edit, undefined);
		assert.deepEqual(change?.lineToRemove, {
			start: { line: 0, column: 0, index: 0 },
			end: { line: 0, column: 39, index: 39 },
		});
	});

	it('should remove only the specified named import while preserving other named imports', () => {
		const code = dedent`
			const { types, diff } = require('node:util');
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const requireStatement = node.find({
			rule: {
				kind: 'lexical_declaration',
			},
		});

		const change = removeBinding(requireStatement!, 'types');
		const sourceCode = node.commitEdits([change.edit!]);

		assert.notEqual(change, null);
		assert.strictEqual(change?.lineToRemove, undefined);
		assert.strictEqual(sourceCode, "const { diff } = require('node:util');");
	});

	it('should remove the entire line when removing the only destructured variable', () => {
		const code = dedent`
			const { mainModule } = process;
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const requireStatement = node.find({
			rule: {
				kind: 'lexical_declaration',
			},
		});

		const change = removeBinding(requireStatement!, 'mainModule');

		assert.notEqual(change, null);
		assert.strictEqual(change?.edit, undefined);
		assert.deepEqual(change?.lineToRemove, {
			start: { line: 0, column: 0, index: 0 },
			end: { line: 0, column: 31, index: 31 },
		});
	});

	it('should remove the entire import statement when the only imported binding is removed', () => {
		const code = dedent`
			import util from 'node:util';
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const importStatement = node.find({
			rule: {
				kind: 'import_statement',
			},
		});

		const change = removeBinding(importStatement!, 'util');

		assert.notEqual(change, null);
		assert.deepEqual(change?.lineToRemove, {
			start: { line: 0, column: 0, index: 0 },
			end: { line: 0, column: 29, index: 29 },
		});
		assert.strictEqual(change?.edit, undefined);
	});

	it('should return undefined when trying to remove a non-existent binding from an import statement', () => {
		const code = dedent`
			import util from 'node:util';
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const importStatement = node.find({
			rule: {
				kind: 'import_statement',
			},
		});

		// line 12 it was imported as util, and here is passed types to be removed
		const change = removeBinding(importStatement!, 'types');

		assert.equal(change, undefined);
	});

	it('should remove the entire import statement when the only namespace import is removed', () => {
		const code = dedent`
			import * as util from 'node:util';
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const importStatement = node.find({
			rule: {
				kind: 'import_statement',
			},
		});

		const change = removeBinding(importStatement!, 'util');

		assert.notEqual(change, null);
		assert.deepEqual(change?.lineToRemove, {
			start: { line: 0, column: 0, index: 0 },
			end: { line: 0, column: 34, index: 34 },
		});
		assert.strictEqual(change?.edit, undefined);
	});

	it('should not remove the import statement when the namespace identifier does not match', () => {
		const code = dedent`
			import * as util from 'node:util';
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const importStatement = node.find({
			rule: {
				kind: 'import_statement',
			},
		});

		const change = removeBinding(importStatement!, 'types');

		assert.equal(change, undefined);
	});

	it('should remove the entire import statement when the only named import is removed', () => {
		const code = dedent`
			import { types } from 'node:util';
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const importStatement = node.find({
			rule: {
				kind: 'import_statement',
			},
		});

		const change = removeBinding(importStatement!, 'types');

		assert.notEqual(change, null);
		assert.deepEqual(change?.lineToRemove, {
			start: { line: 0, column: 0, index: 0 },
			end: { line: 0, column: 34, index: 34 },
		});
		assert.strictEqual(change?.edit, undefined);
	});

	it('should remove a specific named import from an import statement with multiple imports', () => {
		const code = dedent`
			import { types, diff } from 'node:util';
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const importStatement = node.find({
			rule: {
				kind: 'import_statement',
			},
		});

		const change = removeBinding(importStatement!, 'types');
		const sourceCode = node.commitEdits([change.edit!]);

		assert.notEqual(change, null);
		assert.strictEqual(change?.lineToRemove, undefined);
		assert.strictEqual(sourceCode, "import { diff } from 'node:util';");
	});

	it('should return undefined when trying to remove a binding that does not exist in the import statement', () => {
		const code = dedent`
			import { types, diff } from 'node:util';
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const importStatement = node.find({
			rule: {
				kind: 'import_statement',
			},
		});

		const change = removeBinding(importStatement!, 'none');

		assert.equal(change, undefined);
	});

	it('should remove the entire import line when only one aliased binding is imported and it matches the alias', () => {
		const code = dedent`
			import { types as utilTypes } from 'node:util';
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const importStatement = node.find({
			rule: {
				kind: 'import_statement',
			},
		});

		const change = removeBinding(importStatement!, 'utilTypes');

		assert.notEqual(change, null);
		assert.deepEqual(change?.lineToRemove, {
			start: { line: 0, column: 0, index: 0 },
			end: { line: 0, column: 47, index: 47 },
		});
		assert.strictEqual(change?.edit, undefined);
	});

	it('should remove only the aliased import binding when it matches the provided alias', () => {
		const code = dedent`
			import { types as utilTypes, diff } from 'node:util';
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const importStatement = node.find({
			rule: {
				kind: 'import_statement',
			},
		});

		const change = removeBinding(importStatement!, 'utilTypes');
		const sourceCode = node.commitEdits([change.edit!]);

		assert.notEqual(change, null);
		assert.strictEqual(change?.lineToRemove, undefined);
		assert.strictEqual(sourceCode, "import { diff } from 'node:util';");
	});

	it('should remove only the aliased import binding when it matches the provided alias among multiple aliased imports', () => {
		const code = dedent`
			import { types as utilTypes, diff as utilDiffs } from 'node:util';
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const importStatement = node.find({
			rule: {
				kind: 'import_statement',
			},
		});

		const change = removeBinding(importStatement!, 'utilTypes');
		const sourceCode = node.commitEdits([change.edit!]);

		assert.notEqual(change, null);
		assert.strictEqual(change?.lineToRemove, undefined);
		assert.strictEqual(
			sourceCode,
			"import { diff as utilDiffs } from 'node:util';",
		);
	});

	it('should remove only the specific import binding from nested destructuring when multiple bindings exist', () => {
		const code = dedent`
			const { types: { isNativeError, isMap } } = require("util");
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const importStatement = node.find({
			rule: {
				kind: 'lexical_declaration',
			},
		});

		const change = removeBinding(importStatement!, 'isNativeError');
		const sourceCode = node.commitEdits([change.edit!]);

		assert.notEqual(change, null);
		assert.strictEqual(change?.lineToRemove, undefined);
		assert.strictEqual(
			sourceCode,
			`const { types: { isMap } } = require("util");`,
		);
	});

	it('Should remove the line in member expression scenarios', () => {
		const code = dedent`
			const Buffer = require("buffer").Buffer;
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const importStatement = node.find({
			rule: {
				kind: 'lexical_declaration',
			},
		});

		const change = removeBinding(importStatement!, 'Buffer');

		assert.notEqual(change, undefined);
		assert.strictEqual(change?.edit, undefined);
		assert.deepEqual(change?.lineToRemove, {
			end: {
				column: 40,
				index: 40,
				line: 0,
			},
			start: {
				column: 0,
				index: 0,
				line: 0,
			},
		});
	});

	it('Should remove the line when the accessed property is different from the identifier', () => {
		const code = dedent`
			const Buffer = require("buffer").SlowBuffer
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const importStatement = node.find({
			rule: {
				kind: 'lexical_declaration',
			},
		});

		const change = removeBinding(importStatement!, 'Buffer');

		assert.notEqual(change, undefined);
		assert.strictEqual(change?.edit, undefined);
		assert.deepEqual(change?.lineToRemove, {
			end: {
				column: 43,
				index: 43,
				line: 0,
			},
			start: {
				column: 0,
				index: 0,
				line: 0,
			},
		});
	});
});

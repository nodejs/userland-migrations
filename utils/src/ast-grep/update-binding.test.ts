import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import astGrep from '@ast-grep/napi';
import dedent from 'dedent';
import { updateBinding } from './update-binding.ts';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import type { SgNode } from '@codemod.com/jssg-types/main';

describe('update-binding', () => {
	it('should update only the specified named import while preserving other named imports', () => {
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

		const change = updateBinding(requireStatement!, 'types', {
			newBinding: 'newTypes',
		});
		const sourceCode = node.commitEdits([change?.edit!]);

		assert.notEqual(change, null);
		assert.strictEqual(change?.lineToRemove, undefined);
		assert.strictEqual(
			sourceCode,
			"const { diff, newTypes } = require('node:util');",
		);
	});

	it('should update the specified named import', () => {
		const code = dedent`
			const { types } = require('node:util');
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const requireStatement = node.find({
			rule: {
				kind: 'lexical_declaration',
			},
		});

		const change = updateBinding(requireStatement!, 'types', {
			newBinding: 'newTypes',
		});
		const sourceCode = node.commitEdits([change?.edit!]);

		assert.notEqual(change, undefined);
		assert.strictEqual(change?.lineToRemove, undefined);
		assert.strictEqual(
			sourceCode,
			"const { newTypes } = require('node:util');",
		);
	});

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

		const change = updateBinding(requireStatement!, 'util');

		assert.notEqual(change, null);
		assert.strictEqual(change?.edit, undefined);
		assert.deepEqual(change?.lineToRemove, {
			start: { line: 0, column: 0, index: 0 },
			end: { line: 0, column: 34, index: 34 },
		});
	});

	it('should update only the specified named import while preserving other named imports', () => {
		const code = dedent`
			import { types, diff } = from 'node:util';
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const requireStatement = node.find({
			rule: {
				kind: 'import_statement',
			},
		});

		const change = updateBinding(requireStatement!, 'types', {
			newBinding: 'newTypes',
		});
		const sourceCode = node.commitEdits([change?.edit!]);

		assert.notEqual(change, null);
		assert.strictEqual(change?.lineToRemove, undefined);
		assert.strictEqual(
			sourceCode,
			"import { diff, newTypes } = from 'node:util';",
		);
	});

	it('should remove the specified named import while preserving other named imports', () => {
		const code = dedent`
			import { types, diff } = from 'node:util';
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const requireStatement = node.find({
			rule: {
				kind: 'import_statement',
			},
		});

		const change = updateBinding(requireStatement!, 'types');
		const sourceCode = node.commitEdits([change?.edit!]);

		assert.notEqual(change, null);
		assert.strictEqual(change?.lineToRemove, undefined);
		assert.strictEqual(sourceCode, "import { diff } = from 'node:util';");
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

		const change = updateBinding(importStatement!, 'util');

		assert.notEqual(change, null);
		assert.deepEqual(change?.lineToRemove, {
			start: { line: 0, column: 0, index: 0 },
			end: { line: 0, column: 29, index: 29 },
		});
		assert.strictEqual(change?.edit, undefined);
	});

	it('should remove the entire import statement when removing the only named import', () => {
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

		const change = updateBinding(importStatement!, 'types');

		assert.notEqual(change, null);
		assert.deepEqual(change?.lineToRemove, {
			start: { line: 0, column: 0, index: 0 },
			end: { line: 0, column: 34, index: 34 },
		});
		assert.strictEqual(change?.edit, undefined);
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

		const change = updateBinding(importStatement!, 'utilTypes');

		assert.notEqual(change, null);
		assert.deepEqual(change?.lineToRemove, {
			start: { line: 0, column: 0, index: 0 },
			end: { line: 0, column: 47, index: 47 },
		});
		assert.strictEqual(change?.edit, undefined);
	});

	it('should update the entire import line when only one aliased binding is imported and it matches the alias', () => {
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

		const change = updateBinding(importStatement!, 'utilTypes', {
			newBinding: 'newTypes',
		});
		const sourceCode = node.commitEdits([change?.edit!]);

		assert.notEqual(change, null);
		assert.strictEqual(change?.lineToRemove, undefined);
		assert.strictEqual(
			sourceCode,
			"import { newTypes as utilTypes } from 'node:util';",
		);
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

		const change = updateBinding(importStatement!, 'utilTypes');
		const sourceCode = node.commitEdits([change?.edit!]);

		assert.notEqual(change, null);
		assert.strictEqual(change?.lineToRemove, undefined);
		assert.strictEqual(sourceCode, "import { diff } from 'node:util';");
	});

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

		const change = updateBinding(requireStatement!, 'util');

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
		const change = updateBinding(requireStatement!, 'types');

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

		const change = updateBinding(importStatement!, 'types');

		assert.notEqual(change, null);
		assert.strictEqual(change?.edit, undefined);
		assert.deepEqual(change?.lineToRemove, {
			start: { line: 0, column: 0, index: 0 },
			end: { line: 0, column: 39, index: 39 },
		});
	});

	it('should update the destructured variable', () => {
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

		const change = updateBinding(requireStatement!, 'mainModule', {
			newBinding: 'newMainModule',
		});
		const sourceCode = node.commitEdits([change?.edit!]);

		assert.notEqual(change, null);
		assert.strictEqual(change?.lineToRemove, undefined);
		assert.strictEqual(sourceCode, 'const { newMainModule } = process;');
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

		const change = updateBinding(importStatement!, 'util');

		assert.notEqual(change, null);
		assert.deepEqual(change?.lineToRemove, {
			start: { line: 0, column: 0, index: 0 },
			end: { line: 0, column: 34, index: 34 },
		});
		assert.strictEqual(change?.edit, undefined);
	});

	it('should update the namespace binding when newBinding is passed', () => {
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

		const change = updateBinding(importStatement!, 'util', {
			newBinding: 'newUtil',
		});
		const sourceCode = node.commitEdits([change?.edit!]);

		assert.notEqual(change, null);
		assert.strictEqual(change?.lineToRemove, undefined);
		assert.strictEqual(sourceCode, "import * as newUtil from 'node:util';");
	});

	it('should return undefined when trying to update a binding that does not exist in the import statement', () => {
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

		const change = updateBinding(importStatement!, 'none', {
			newBinding: 'newNone',
		});

		assert.equal(change, undefined);
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

		const change = updateBinding(importStatement!, 'utilTypes');
		const sourceCode = node.commitEdits([change?.edit!]);

		assert.notEqual(change, null);
		assert.strictEqual(change?.lineToRemove, undefined);
		assert.strictEqual(sourceCode, "import { diff } from 'node:util';");
	});

	it('should update only the aliased import binding when it matches the provided alias among multiple aliased imports', () => {
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

		const change = updateBinding(importStatement!, 'utilTypes', {
			newBinding: 'newTypes',
		});
		const sourceCode = node.commitEdits([change?.edit!]);

		assert.notEqual(change, null);
		assert.strictEqual(change?.lineToRemove, undefined);
		assert.strictEqual(
			sourceCode,
			"import { newTypes as utilTypes, diff as utilDiffs } from 'node:util';",
		);
	});

	it('Should update destructured property access from require statement to named import', () => {
		const code = dedent`
			const SlowBuffer = require("buffer").SlowBuffer;
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const requireStatement = node.find({
			rule: {
				kind: 'lexical_declaration',
			},
		});

		const change = updateBinding(requireStatement!, 'SlowBuffer', {
			newBinding: 'Buffer',
		});

		assert.notEqual(change, undefined);
		assert.strictEqual(change?.lineToRemove, undefined);

		const sourceCode = node.commitEdits([change?.edit!]);

		assert.strictEqual(sourceCode, `const { Buffer } = require("buffer");`);
	});

	it('Should remove entire require when property access exists require statement', () => {
		const code = dedent`
			const SlowBuffer = require("buffer").SlowBuffer;
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const requireStatement = node.find({
			rule: {
				kind: 'lexical_declaration',
			},
		});

		const change = updateBinding(requireStatement!, 'SlowBuffer');

		assert.notEqual(change, undefined);
		assert.strictEqual(change.edit, undefined);
		assert.deepEqual(change?.lineToRemove, {
			end: {
				column: 48,
				index: 48,
				line: 0,
			},
			start: {
				column: 0,
				index: 0,
				line: 0,
			},
		});
	});

	it('If named import already exists it just needs to remove the old reference', () => {
		const code = dedent`
			const { SlowBuffer, Buffer } = require("buffer");
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const requireStatement = node.find({
			rule: {
				kind: 'lexical_declaration',
			},
		});

		const change = updateBinding(requireStatement!, 'SlowBuffer', {
			newBinding: 'Buffer',
		});

		assert.notEqual(change, undefined);
		assert.strictEqual(change?.lineToRemove, undefined);

		const sourceCode = node.commitEdits([change?.edit!]);

		assert.strictEqual(sourceCode, `const { Buffer } = require("buffer");`);
	});
});

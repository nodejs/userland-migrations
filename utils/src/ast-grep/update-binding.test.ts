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

		const change = updateBinding(requireStatement!, {
			old: 'types',
			new: 'newTypes',
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

		const change = updateBinding(requireStatement!, {
			old: 'types',
			new: 'newTypes',
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

		const change = updateBinding(requireStatement!, {
			old: 'util',
		});

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

		const change = updateBinding(requireStatement!, {
			old: 'types',
			new: 'newTypes',
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

		const change = updateBinding(requireStatement!, {
			old: 'types',
		});
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

		const change = updateBinding(importStatement!, {
			old: 'util',
		});

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

		const change = updateBinding(importStatement!, {
			old: 'types',
		});

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

		const change = updateBinding(importStatement!, {
			old: 'utilTypes',
		});

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

		const change = updateBinding(importStatement!, {
			old: 'utilTypes',
			new: 'newTypes',
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

		const change = updateBinding(importStatement!, {
			old: 'utilTypes',
		});
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

		const change = updateBinding(requireStatement!, {
			old: 'util',
		});

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
		const change = updateBinding(requireStatement!, {
			old: 'types',
		});

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

		const change = updateBinding(importStatement!, {
			old: 'types',
		});

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

		const change = updateBinding(requireStatement!, {
			old: 'mainModule',
			new: 'newMainModule',
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

		const change = updateBinding(importStatement!, {
			old: 'util',
		});

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

		const change = updateBinding(importStatement!, {
			old: 'util',
			new: 'newUtil',
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

		const change = updateBinding(importStatement!, {
			old: 'none',
			new: 'newNone',
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

		const change = updateBinding(importStatement!, {
			old: 'utilTypes',
		});
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

		const change = updateBinding(importStatement!, {
			old: 'utilTypes',
			new: 'newTypes',
		});
		const sourceCode = node.commitEdits([change?.edit!]);

		assert.notEqual(change, null);
		assert.strictEqual(change?.lineToRemove, undefined);
		assert.strictEqual(
			sourceCode,
			"import { newTypes as utilTypes, diff as utilDiffs } from 'node:util';",
		);
	});

	it('should update destructured property access from require statement to named import', () => {
		const code = dedent`
			const Test = require("buffer").SlowBuffer;
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const requireStatement = node.find({
			rule: {
				kind: 'lexical_declaration',
			},
		});

		const change = updateBinding(requireStatement!, {
			old: 'Test',
			new: 'Buffer',
		});

		assert.notEqual(change, undefined);
		assert.strictEqual(change?.lineToRemove, undefined);

		const sourceCode = node.commitEdits([change?.edit!]);

		assert.strictEqual(sourceCode, `const { Buffer } = require("buffer");`);
	});

	it('should remove entire require when property access exists in require statement', () => {
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

		const change = updateBinding(requireStatement!, {
			old: 'SlowBuffer',
		});

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

	it('should remove only the old reference when the new binding already exists', () => {
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

		const change = updateBinding(requireStatement!, {
			old: 'SlowBuffer',
			new: 'Buffer',
		});

		assert.notEqual(change, undefined);
		assert.strictEqual(change?.lineToRemove, undefined);

		const sourceCode = node.commitEdits([change?.edit!]);

		assert.strictEqual(sourceCode, `const { Buffer } = require("buffer");`);
	});

	it('should create new binding in require when oldBinding is not passed', () => {
		const code = dedent`
			const { SlowBuffer } = require("buffer");
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const requireStatement = node.find({
			rule: {
				kind: 'lexical_declaration',
			},
		});

		const change = updateBinding(requireStatement!, {
			new: 'Buffer',
		});

		assert.notEqual(change, undefined);
		assert.strictEqual(change?.lineToRemove, undefined);

		const sourceCode = node.commitEdits([change?.edit!]);

		assert.strictEqual(
			sourceCode,
			`const { SlowBuffer, Buffer } = require("buffer");`,
		);
	});

	it('should create new binding in import when oldBinding is not passed', () => {
		const code = dedent`
			import { SlowBuffer } from 'buffer';
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const requireStatement = node.find({
			rule: {
				kind: 'import_statement',
			},
		});

		const change = updateBinding(requireStatement!, {
			new: 'Buffer',
		});

		assert.notEqual(change, undefined);
		assert.strictEqual(change?.lineToRemove, undefined);

		const sourceCode = node.commitEdits([change?.edit!]);

		assert.strictEqual(
			sourceCode,
			`import { SlowBuffer, Buffer } from 'buffer';`,
		);
	});

	it('should replace one binding with multiple bindings in require statement', () => {
		const code = dedent`
			const { fips } = require('node:crypto');
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const requireStatement = node.find({
			rule: {
				kind: 'lexical_declaration',
			},
		});

		const change = updateBinding(requireStatement!, {
			old: 'fips',
			new: ['getFips', 'setFips'],
		});

		assert.notEqual(change, undefined);
		assert.strictEqual(change?.lineToRemove, undefined);

		const sourceCode = node.commitEdits([change?.edit!]);

		assert.strictEqual(
			sourceCode,
			`const { getFips, setFips } = require('node:crypto');`,
		);
	});

	it('should replace one binding with multiple bindings in import statement', () => {
		const code = dedent`
			import { fips } from 'node:crypto';
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const importStatement = node.find({
			rule: {
				kind: 'import_statement',
			},
		});

		const change = updateBinding(importStatement!, {
			old: 'fips',
			new: ['getFips', 'setFips'],
		});

		assert.notEqual(change, undefined);
		assert.strictEqual(change?.lineToRemove, undefined);

		const sourceCode = node.commitEdits([change?.edit!]);

		assert.strictEqual(
			sourceCode,
			`import { getFips, setFips } from 'node:crypto';`,
		);
	});

	it('should replace one binding with multiple bindings while preserving other imports', () => {
		const code = dedent`
			const { fips, randomBytes } = require('node:crypto');
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const requireStatement = node.find({
			rule: {
				kind: 'lexical_declaration',
			},
		});

		const change = updateBinding(requireStatement!, {
			old: 'fips',
			new: ['getFips', 'setFips'],
		});

		assert.notEqual(change, undefined);
		assert.strictEqual(change?.lineToRemove, undefined);

		const sourceCode = node.commitEdits([change?.edit!]);

		assert.strictEqual(
			sourceCode,
			`const { randomBytes, getFips, setFips } = require('node:crypto');`,
		);
	});

	it('should not add duplicate bindings when some already exist', () => {
		const code = dedent`
			const { fips, getFips } = require('node:crypto');
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const requireStatement = node.find({
			rule: {
				kind: 'lexical_declaration',
			},
		});

		const change = updateBinding(requireStatement!, {
			old: 'fips',
			new: ['getFips', 'setFips'],
		});

		assert.notEqual(change, undefined);
		assert.strictEqual(change?.lineToRemove, undefined);

		const sourceCode = node.commitEdits([change?.edit!]);

		assert.strictEqual(
			sourceCode,
			`const { getFips, setFips } = require('node:crypto');`,
		);
	});

	it('should add multiple new bindings when oldBinding is not passed', () => {
		const code = dedent`
			const { randomBytes } = require('node:crypto');
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const requireStatement = node.find({
			rule: {
				kind: 'lexical_declaration',
			},
		});

		const change = updateBinding(requireStatement!, {
			new: ['getFips', 'setFips'],
		});

		assert.notEqual(change, undefined);
		assert.strictEqual(change?.lineToRemove, undefined);

		const sourceCode = node.commitEdits([change?.edit!]);

		assert.strictEqual(
			sourceCode,
			`const { randomBytes, getFips, setFips } = require('node:crypto');`,
		);
	});

	it('should replace aliased require with multiple non-aliased bindings', () => {
		const code = dedent`
			const { fips: myFips } = require('node:crypto');
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const requireStatement = node.find({
			rule: {
				kind: 'lexical_declaration',
			},
		});

		const change = updateBinding(requireStatement!, {
			old: 'myFips',
			new: ['getFips', 'setFips'],
		});

		assert.notEqual(change, undefined);
		assert.strictEqual(change?.lineToRemove, undefined);

		const sourceCode = node.commitEdits([change?.edit!]);

		assert.strictEqual(
			sourceCode,
			`const { getFips, setFips } = require('node:crypto');`,
		);
	});

	it('should replace aliased import with multiple non-aliased bindings', () => {
		const code = dedent`
			import { fips as myFips } from 'node:crypto';
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const importStatement = node.find({
			rule: {
				kind: 'import_statement',
			},
		});

		const change = updateBinding(importStatement!, {
			old: 'myFips',
			new: ['getFips', 'setFips'],
		});

		assert.notEqual(change, undefined);
		assert.strictEqual(change?.lineToRemove, undefined);

		const sourceCode = node.commitEdits([change?.edit!]);

		assert.strictEqual(
			sourceCode,
			`import { getFips, setFips } from 'node:crypto';`,
		);
	});

	it('should replace aliased import with multiple bindings while preserving other imports', () => {
		const code = dedent`
			import { fips as myFips, randomBytes } from 'node:crypto';
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = rootNode.root() as SgNode<Js>;

		const importStatement = node.find({
			rule: {
				kind: 'import_statement',
			},
		});

		const change = updateBinding(importStatement!, {
			old: 'myFips',
			new: ['getFips', 'setFips'],
		});

		assert.notEqual(change, undefined);
		assert.strictEqual(change?.lineToRemove, undefined);

		const sourceCode = node.commitEdits([change?.edit!]);

		assert.strictEqual(
			sourceCode,
			`import { randomBytes, getFips, setFips } from 'node:crypto';`,
		);
	});
});

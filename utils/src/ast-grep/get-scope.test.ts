import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import astGrep from '@ast-grep/napi';
import dedent from 'dedent';
import { getScope } from './get-scope.ts';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import type { SgRoot } from '@codemod.com/jssg-types/main';

describe('get-scope-node', () => {
	it('should return thre entire code', () => {
		const code = dedent`
			const x = 'first line'
			const y = 'second line'
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code) as SgRoot<Js>;
		const node = rootNode.root().find<'string_fragment'>({
			rule: {
				kind: 'identifier',
				pattern: 'x',
			},
		});

		const scope = getScope(node!);

		assert.notEqual(scope, null);
		assert.equal(scope?.text(), code);
	});

	it('should return function body from arrow function', () => {
		const code = dedent`
			const x = 'first line'
			const teste = () => {
				const y = 'second line'
			}
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code) as SgRoot<Js>;
		const node = rootNode.root().find<'string_fragment'>({
			rule: {
				kind: 'identifier',
				pattern: 'y',
			},
		});

		const scope = getScope(node!);

		assert.notEqual(scope, null);
		assert.equal(
			scope?.text(),
			dedent`{
				const y = 'second line'
			}`,
		);
	});

	it('should return function body from anonymous functions', () => {
		const code = dedent`
			const x = 'first line'
			const teste = function() {
				const y = 'second line'
			}
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code) as SgRoot<Js>;
		const node = rootNode.root().find<'string_fragment'>({
			rule: {
				kind: 'identifier',
				pattern: 'y',
			},
		});

		const scope = getScope(node!);

		assert.notEqual(scope, null);
		assert.equal(
			scope?.text(),
			dedent`{
				const y = 'second line'
			}`,
		);
	});

	it('should return function body from named functions', () => {
		const code = dedent`
			const x = 'first line'
			function teste() {
				const y = 'second line'
			}
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code) as SgRoot<Js>;
		const node = rootNode.root().find<'string_fragment'>({
			rule: {
				kind: 'identifier',
				pattern: 'y',
			},
		});

		const scope = getScope(node!);

		assert.notEqual(scope, null);
		assert.equal(
			scope?.text(),
			dedent`{
				const y = 'second line'
			}`,
		);
	});

	it('should return if block', () => {
		const code = dedent`
			const x = 'first line'
			if(x === 'first line') {
				const y = 'second line'
			}
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code) as SgRoot<Js>;
		const node = rootNode.root().find<'string_fragment'>({
			rule: {
				kind: 'identifier',
				pattern: 'y',
			},
		});

		const scope = getScope(node!);

		assert.notEqual(scope, null);
		assert.equal(
			scope?.text(),
			dedent`{
				const y = 'second line'
			}`,
		);
	});

	it('should return for block', () => {
		const code = dedent`
			const x = 'first line'
			for(const i = 0; i < 10; i++) {
				const y = 'second line'
			}
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code) as SgRoot<Js>;
		const node = rootNode.root().find<'string_fragment'>({
			rule: {
				kind: 'identifier',
				pattern: 'y',
			},
		});

		const scope = getScope(node!);

		assert.notEqual(scope, null);
		assert.equal(
			scope?.text(),
			dedent`{
				const y = 'second line'
			}`,
		);
	});

	it('should return forOf block', () => {
		const code = dedent`
			const x = 'first line'
			const arr = [1,2]
			for(const i of arr) {
				const y = 'second line'
			}
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code) as SgRoot<Js>;
		const node = rootNode.root().find<'string_fragment'>({
			rule: {
				kind: 'identifier',
				pattern: 'y',
			},
		});

		const scope = getScope(node!);

		assert.notEqual(scope, null);
		assert.equal(
			scope?.text(),
			dedent`{
				const y = 'second line'
			}`,
		);
	});

	it('should return custom node line', () => {
		const code = dedent`
			const x = 'first line'
			const arr = [1,2]
			for(const i of arr) {
				const y = 'second line'
			}
		`;

		const rootNode = astGrep.parse(astGrep.Lang.JavaScript, code) as SgRoot<Js>;
		const node = rootNode.root().find<'identifier'>({
			rule: {
				kind: 'identifier',
				pattern: 'y',
			},
		});

		const scope = getScope(node!, 'lexical_declaration');

		assert.notEqual(scope, null);
		assert.equal(scope?.text(), `const y = 'second line'`);
	});
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import astGrep from '@ast-grep/napi';
import { findParentStatement, isSafeResourceTarget } from './general.ts'; // ts ext is needed

describe('findParentStatement', () => {
	it('should find the parent expression_statement', () => {
		const code = 'function test() { x + 1; }';
		const root = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = root.root().find({
			rule: { kind: 'binary_expression' },
		});

		const parentStatement = findParentStatement(node);
		assert.ok(parentStatement);
		assert.strictEqual(parentStatement?.kind(), 'expression_statement');
	});

	it('should return null if no parent statement is found', () => {
		const code = 'const x = 5;';
		const root = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = root.root().find({
			rule: { kind: 'identifier' },
		});

		const parentStatement = findParentStatement(node);
		assert.strictEqual(parentStatement, null);
	});
});

describe('isSafeResourceTarget', () => {
	it('should return true for an identifier', () => {
		const code = 'function test() { const x = 5; }';
		const root = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = root.root().find({
			rule: { kind: 'identifier' },
		});

		assert.strictEqual(isSafeResourceTarget(node), true);
	});

	it('should return true for a member_expression', () => {
		const code = 'function test() { obj.prop = 5; }';
		const root = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = root.root().find({
			rule: { kind: 'member_expression' },
		});

		assert.strictEqual(isSafeResourceTarget(node), true);
	});

	it('should return false for other node types', () => {
		const code = 'function test() { 5 + 3; }';
		const root = astGrep.parse(astGrep.Lang.JavaScript, code);
		const node = root.root().find({
			rule: { kind: 'binary_expression' },
		});

		assert.strictEqual(isSafeResourceTarget(node), false);
	});
});

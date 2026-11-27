import type { Edit, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';

/*
 * DEP0094: `assert.fail()` with more than one argument.
 *
 * Up to Node.js 24, `assert.fail(actual, expected, message, operator,
 * stackStartFn)` threw an `AssertionError` that carried `actual`, `expected`
 * and `operator`, with a generated message such as `1 != 2` when no message
 * was given. Node.js 25 removed that signature: the extra arguments are
 * ignored and the first argument becomes the message.
 *
 * This codemod keeps the old error by rewriting the call to
 *
 *   throw new assert.AssertionError({ actual, expected, message, operator });
 *
 * matching what the old `assert.fail()` built:
 *
 * - With exactly two arguments, `operator` was `'!='`.
 * - With three or more arguments and no operator, `operator` was `'fail'`.
 * - `stackStartFn` is passed through when given.
 *
 * It only rewrites a call that is a whole statement and whose `message` and
 * `operator` are string literals, template literals without substitutions,
 * or `undefined`. The old `assert.fail()` rethrew `message` when it was an
 * `Error`, which a static rewrite cannot reproduce for other expressions.
 * Every call it skips is reported with `console.warn` for manual review.
 */

/** Imported or required names of the module that holds `assert.fail`. */
const ASSERT_MODULES = ['assert', 'assert/strict'];

/** Position of each `assert.fail()` argument. */
const ACTUAL = 0;
const EXPECTED = 1;
const MESSAGE = 2;
const OPERATOR = 3;
const STACK_START_FN = 4;

export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	for (const moduleName of ASSERT_MODULES) {
		for (const statement of getModuleDependencies(root, moduleName)) {
			const failBinding = resolveBindingPath(statement, '$.fail');
			if (!failBinding) continue;

			// `assert.fail` gives `assert.AssertionError`. A named `fail` binding
			// needs an `AssertionError` binding from the same statement.
			const isMemberAccess = failBinding.includes('.');
			const existingErrorBinding = resolveBindingPath(
				statement,
				'$.AssertionError',
			);
			const errorBinding = isMemberAccess
				? failBinding.replace(/\.fail$/, '.AssertionError')
				: (existingErrorBinding ?? 'AssertionError');

			let rewroteCall = false;

			const calls = rootNode.findAll({
				rule: {
					kind: 'call_expression',
					has: { field: 'function', pattern: failBinding },
				},
			});

			for (const call of calls) {
				const edit = rewriteFailCall(root, call, errorBinding);
				if (!edit) continue;

				edits.push(edit);
				rewroteCall = true;
			}

			if (rewroteCall && !isMemberAccess && !existingErrorBinding) {
				const importEdit = addAssertionErrorBinding(statement);
				if (importEdit) edits.push(importEdit);
			}
		}
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

/**
 * Rewrites one `fail(...)` call with two or more arguments to
 * `throw new AssertionError({ ... })`. Returns `undefined` when the call
 * keeps the supported one-argument form or cannot be rewritten safely.
 */
function rewriteFailCall(
	root: SgRoot<Js>,
	call: SgNode<Js>,
	errorBinding: string,
): Edit | undefined {
	const args = call
		.field('arguments')
		?.children()
		.filter((child) => child.isNamed() && !child.is('comment'));

	if (!args) return undefined;

	// A spread may hold any number of arguments, so it cannot be mapped.
	if (args.length > 5 || args.some((arg) => arg.is('spread_element'))) {
		warn(root, call, 'its arguments cannot be mapped one by one');
		return undefined;
	}

	// `fail()` and `fail(message)` are still supported.
	if (args.length < 2) return undefined;

	const statement = call.parent();
	if (!statement?.is('expression_statement')) {
		warn(root, call, 'the call is not a statement of its own');
		return undefined;
	}

	const message = args[MESSAGE];
	const operator = args[OPERATOR];
	const stackStartFn = args[STACK_START_FN];

	if (
		(message && !isStaticValue(message)) ||
		(operator && !isStaticValue(operator))
	) {
		warn(
			root,
			call,
			'the message or operator is not a literal, and the old assert.fail() rethrew a message that was an Error',
		);
		return undefined;
	}

	const properties = [
		`actual: ${args[ACTUAL].text()}`,
		`expected: ${args[EXPECTED].text()}`,
	];

	if (message && !isUndefined(message)) {
		properties.push(`message: ${message.text()}`);
	}

	if (args.length === 2) {
		properties.push(`operator: '!='`);
	} else if (operator && !isUndefined(operator)) {
		properties.push(`operator: ${operator.text()}`);
	} else {
		properties.push(`operator: 'fail'`);
	}

	if (stackStartFn) {
		properties.push(`stackStartFn: ${stackStartFn.text()}`);
	}

	const semicolon = statement.text().trimEnd().endsWith(';') ? ';' : '';

	return statement.replace(
		`throw new ${errorBinding}({ ${properties.join(', ')} })${semicolon}`,
	);
}

/**
 * Adds `AssertionError` next to `fail` in a destructuring `require` or a
 * named `import`, e.g. `{ fail }` becomes `{ fail, AssertionError }`.
 */
function addAssertionErrorBinding(statement: SgNode<Js>): Edit | undefined {
	const bindings = statement.find({
		rule: { any: [{ kind: 'named_imports' }, { kind: 'object_pattern' }] },
	});
	if (!bindings) return undefined;

	const entries = bindings
		.children()
		.filter((child) => child.isNamed() && !child.is('comment'));
	const lastEntry = entries.at(-1);
	if (!lastEntry) return undefined;

	const position = lastEntry.range().end.index;

	return {
		startPos: position,
		endPos: position,
		insertedText: ', AssertionError',
	};
}

/**
 * Whether `node` has a value known without running the code: a string
 * literal, a template literal without substitutions, or `undefined`.
 */
function isStaticValue(node: SgNode<Js>): boolean {
	if (node.is('string') || isUndefined(node)) return true;

	return (
		node.is('template_string') &&
		!node.find({ rule: { kind: 'template_substitution' } })
	);
}

function isUndefined(node: SgNode<Js>): boolean {
	return (
		node.is('undefined') ||
		(node.is('identifier') && node.text() === 'undefined')
	);
}

function warn(root: SgRoot<Js>, node: SgNode<Js>, reason: string): void {
	const { line, column } = node.range().start;

	console.warn(
		`[Codemod] DEP0094: assert.fail() with more than one argument was left unchanged because ${reason}. Migrate it by hand. (at ${root.filename()}:${line + 1}:${column + 1})`,
	);
}

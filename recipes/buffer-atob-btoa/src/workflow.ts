import type { Edit, Kinds, Range, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import { removeBinding } from '@nodejs/codemod-utils/ast-grep/remove-binding';

export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const bindingStatementFnTuples: [string, SgNode<Js>, (arg: string) => string][] = [];
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	const updates = [
		{
			oldBind: "$.atob",
			replaceFn: (arg: string) => `Buffer.from(${arg}, 'base64').toString('binary')`
		},
		{
			oldBind: "$.btoa",
			replaceFn: (arg: string) => `Buffer.from(${arg}, 'binary').toString('base64')`
		}
	];

	const statements = [
		...getNodeRequireCalls(root, 'buffer'),
		...getNodeImportStatements(root, 'buffer')
	];

	for (const statement of statements) {
		for (const update of updates) {
			const binding = resolveBindingPath(statement, update.oldBind);
			if (binding) bindingStatementFnTuples.push([binding, statement, update.replaceFn]);
		}
	}

	for (const [binding, statement, fn] of bindingStatementFnTuples) {
		const result = removeBinding(statement, binding);

		if (result?.edit) edits.push(result.edit);
		if (result?.lineToRemove) linesToRemove.push(result.lineToRemove);
		// Check for calls to the specified binding
		const calls = rootNode.findAll({
			rule: {
				pattern: `${binding}($ARG)`
			}
		});
		// Check for any other calls, so as to not remove a statement that is still being used
		const otherCalls = rootNode.findAll({
			rule: {
				all: [
					{
						pattern: 'buffer.$FN'
					},
					{
						not: {
							pattern: '$.btoa($ARG)'
						}
					},
					{
						not: {
							pattern: '$.atob($ARG)'
						}
					}
				]
			}
		});

		for (const call of calls) {
			const argMatch = call.getMatch("ARG");
			if (argMatch) edits.push(call.replace(fn(argMatch.text())));
		}

		if (calls.length === otherCalls.length) {
			linesToRemove.push(statement.range());
		}
	}

	if (!edits.length) return null;

	return removeLines(rootNode.commitEdits(edits), linesToRemove);
}

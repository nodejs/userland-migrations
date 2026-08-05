import { useMetricAtom } from 'codemod:metrics';
import type { Edit, Range, SgNode, Codemod } from 'codemod:ast-grep';
import type Js from 'codemod:ast-grep/langs/javascript';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import { removeBinding } from '@nodejs/codemod-utils/ast-grep/remove-binding';


const migrationMetric = useMetricAtom('buffer-atob-btoa-migrations');
const filesMetric = useMetricAtom('buffer-atob-btoa-files');

const transform: Codemod<Js> = async (root) => {
	const rootNode = root.root();
	const bindingStatementFnTuples: [
		string,
		SgNode<Js>,
		(arg: string) => string,
	][] = [];
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	const updates = [
		{
			oldBind: '$.atob',
			replaceFn: (arg: string) =>
				`Buffer.from(${arg}, 'base64').toString('binary')`,
		},
		{
			oldBind: '$.btoa',
			replaceFn: (arg: string) =>
				`Buffer.from(${arg}, 'binary').toString('base64')`,
		},
	];

	const statements = getModuleDependencies(root, 'buffer');

	// If no statements found, skip transformation
	if (!statements.length) return null;

	filesMetric.increment({ status: 'has-buffer-import' });

	for (const statement of statements) {
		for (const update of updates) {
			const binding = resolveBindingPath(statement, update.oldBind);
			if (binding)
				bindingStatementFnTuples.push([binding, statement, update.replaceFn]);
		}
	}

	for (const [binding, statement, fn] of bindingStatementFnTuples) {
		const result = removeBinding(statement, binding);
		const fnName = binding.split('.').pop() ?? binding;

		if (result?.edit) edits.push(result.edit);
		if (result?.lineToRemove) linesToRemove.push(result.lineToRemove);
		// Check for calls to the specified binding
		const calls = rootNode.findAll({
			rule: {
				pattern: `${binding}($ARG)`,
			},
		});
		// Check for any other calls, so as to not remove a statement that is still being used
		const otherCalls = rootNode.findAll({
			rule: {
				all: [
					{
						pattern: 'buffer.$FN',
					},
					{
						not: {
							pattern: '$.btoa($ARG)',
						},
					},
					{
						not: {
							pattern: '$.atob($ARG)',
						},
					},
				],
			},
		});

		for (const call of calls) {
			const argMatch = call.getMatch('ARG');

			if (argMatch) {
				edits.push(call.replace(fn(argMatch.text())));
				migrationMetric.increment({ fn: fnName });
			}
		}

		if (calls.length === otherCalls.length) {
			linesToRemove.push(statement.range());
		}
	}

	if (!edits.length) {
		filesMetric.increment({ status: 'no-changes' });
		return null;
	}

	filesMetric.increment({ status: 'migrated' });

	return removeLines(rootNode.commitEdits(edits), linesToRemove);
}

export default transform;

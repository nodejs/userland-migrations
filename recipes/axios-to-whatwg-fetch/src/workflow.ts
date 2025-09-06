import type {
	Edit,
	Kinds,
	Range,
	Rule,
	SgNode,
	SgRoot,
	TypesMap,
} from '@codemod.com/jssg-types/main';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { removeBinding } from '@nodejs/codemod-utils/ast-grep/remove-binding';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import dedent from 'dedent';

type BindingToReplace = {
	rule: Rule<TypesMap>;
	node: SgNode<TypesMap, Kinds<TypesMap>>;
	binding: string;
	replaceFn: (arg: SgNode[]) => string;
};

const transformOptions = (args: SgNode[]) => {
	console.log({ argsLength: args.length, args: args.map((t) => t.text()) });
};

const transformBody = (args: SgNode[]) => {
	console.log({ argsLength: args.length, args: args.map((t) => t.text()) });

	return;
};

const transformOptionsNode = (options: SgNode) => {
	if (!options) return '';

	const headers = options.find({
		rule: {
			kind: 'object',
			inside: {
				kind: 'pair',
				has: {
					kind: 'property_identifier',
					field: 'key',
					regex: 'headers',
				},
			},
		},
	});

	if (headers?.kind()) {
		return dedent`, {
			headers: ${headers.text()},
		}`;
	}
};

const updates: { oldBind: string; replaceFn: BindingToReplace['replaceFn'] }[] =
	[
		{
			oldBind: '$.request',
			replaceFn: (arg) => `console.log(${arg})`,
		},
		{
			oldBind: '$.get',
			replaceFn: (args) => {
				const url = args.length > 0 && args[0];
				const options = transformOptionsNode(args[1]);
				return dedent.withOptions({ alignValues: true })`
			fetch(${url.text()}${options})
				.then(async (res) => Object.assign(res, { data: await res.json() }))
				.catch(() => null)
			`;
			},
		},
		{
			oldBind: '$.post',
			replaceFn: (arg: FunctionArgs) => `console.error(${arg})`,
		},
		{
			oldBind: '$.put',
			replaceFn: (arg: FunctionArgs) => `console.error(${arg})`,
		},
		{
			oldBind: '$.patch',
			replaceFn: (arg: FunctionArgs) => `console.error(${arg})`,
		},
		{
			oldBind: '$.delete',
			replaceFn: (arg: FunctionArgs) => `console.error(${arg})`,
		},
		{
			oldBind: '$.head',
			replaceFn: (arg: FunctionArgs) => `console.error(${arg})`,
		},
		{
			oldBind: '$.options',
			replaceFn: (arg: FunctionArgs) => `console.error(${arg})`,
		},
	];

/*
 * Transforms `util.requestj($$$ARG)` usage to `console.log($$$ARG)`.
 * Transforms `util.get($$$ARG)` usage to `console.log($$$ARG)`.
 * Transforms `util.post($$$ARG)` usage to `console.error($$$ARG)`.
 * Transforms `util.put($$$ARG)` usage to `console.error($$$ARG)`.
 *
 * Steps:
 *
 * Locate all `util.print|puts|debug|error` import imports, noting the replacement rule, import node, and binding name.
 *
 * For each binding, replace calls to util.print|puts|debug|error($$$ARG) with the new console.log|error format,
 * and determine if the import line should be updated or removed.
 *
 * Apply all changes, removing or updating the import line as needed.
 */
export default function transform(root: SgRoot): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];
	const bindsToReplace: BindingToReplace[] = [];

	const nodeRequires = getNodeRequireCalls(root, 'axios');
	const nodeImports = getNodeImportStatements(root, 'axios');
	const importRequireStatement = [...nodeRequires, ...nodeImports];

	if (!importRequireStatement.length) return null;

	for (const node of importRequireStatement) {
		for (const update of updates) {
			const bind = resolveBindingPath(node, update.oldBind);

			if (!bind) continue;

			bindsToReplace.push({
				rule: {
					pattern: `${bind}($$$ARG)`,
				},
				node,
				binding: bind,
				replaceFn: update.replaceFn,
			});
		}
	}

	for (const bind of bindsToReplace) {
		const matches = rootNode.findAll({
			rule: bind.rule,
		});

		for (const match of matches) {
			const argsAndCommaas = match.getMultipleMatches('ARG');
			const args = argsAndCommaas.filter((arg) => arg.text() !== ',');

			const replace = match.replace(bind.replaceFn(args));
			edits.push(replace);

			// const replace = match.replace(bind.replaceFn(argsStr));
			// edits.push(replace);
			//
			const result = removeBinding(bind.node, bind.binding.split('.').at(0));

			if (result?.lineToRemove) {
				linesToRemove.push(result.lineToRemove);
			}

			if (result?.edit) {
				edits.push(result.edit);
			}
		}
	}

	if (!edits.length) return;

	const sourceCode = rootNode.commitEdits(edits);

	return removeLines(sourceCode, linesToRemove);
}

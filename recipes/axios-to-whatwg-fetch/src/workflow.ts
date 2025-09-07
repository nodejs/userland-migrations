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
import os from 'node:os';

type BindingToReplace = {
	rule: Rule<TypesMap>;
	node: SgNode<TypesMap, Kinds<TypesMap>>;
	binding: string;
	replaceFn: (arg: SgNode[]) => string;
};

type CreateOptionsType = {
	oldOptions?: SgNode;
	method?: string;
	body?: string;
};
const createOptions = ({ oldOptions, method, body }: CreateOptionsType) => {
	if (!oldOptions && !method && !body) return '';
	const headers = oldOptions?.find({
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

	const options = [];

	if (method) {
		options.push(`method: '${method}'`);
	}

	if (headers) {
		options.push(`headers: ${headers?.text()}`);
	}

	if (body) {
		options.push(`body: JSON.stringify(${body})`);
	}

	if (options.length === 1) return `{ ${options.toString()} }`;

	return dedent.withOptions({ alignValues: true })`{
		${options.join(`,${os.EOL}`)}
	}`;
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
				const options = createOptions({
					oldOptions: args[1],
				});
				return dedent.withOptions({ alignValues: true })`
			fetch(${url.text()}${options ? `, ${options}` : ''})
				.then(async (res) => Object.assign(res, { data: await res.json() }))
				.catch(() => null)
			`;
			},
		},
		{
			oldBind: '$.post',
			replaceFn: (args) => {
				const url = args.length > 0 && args[0];
				const options = createOptions({
					oldOptions: args[2],
					method: 'POST',
					body: args[1]?.text(),
				});
				return dedent.withOptions({ alignValues: true })`
			fetch(${url.text()}${options ? `, ${options}` : ''})
				.then(async (res) => Object.assign(res, { data: await res.json() }))
				.catch(() => null)
			`;
			},
		},
		{
			oldBind: '$.put',
			replaceFn: (args) => {
				const url = args.length > 0 && args[0];
				const options = createOptions({
					oldOptions: args[2],
					method: 'PUT',
					body: args[1]?.text(),
				});
				return dedent.withOptions({ alignValues: true })`
			fetch(${url.text()}${options ? `, ${options}` : ''})
				.then(async (res) => Object.assign(res, { data: await res.json() }))
				.catch(() => null)
			`;
			},
		},
		{
			oldBind: '$.patch',
			replaceFn: (args) => {
				const url = args.length > 0 && args[0];
				const options = createOptions({
					oldOptions: args[2],
					method: 'PATCH',
					body: args[1]?.text(),
				});
				return dedent.withOptions({ alignValues: true })`
			fetch(${url.text()}${options ? `, ${options}` : ''})
				.then(async (res) => Object.assign(res, { data: await res.json() }))
				.catch(() => null)
			`;
			},
		},
		{
			oldBind: '$.delete',
			replaceFn: (args) => {
				const url = args.length > 0 && args[0];
				const options = createOptions({
					oldOptions: args[1],
					method: 'DELETE',
				});
				return dedent.withOptions({ alignValues: true })`
			fetch(${url.text()}, ${options})
				.then(async (res) => Object.assign(res, { data: await res.json() }))
				.catch(() => null)
			`;
			},
		},
		{
			oldBind: '$.head',
			replaceFn: (args) => {
				const url = args.length > 0 && args[0];
				const options = createOptions({
					oldOptions: args[1],
					method: 'HEAD',
				});
				return dedent.withOptions({ alignValues: true })`
			fetch(${url.text()}, ${options})
				.then(async (res) => Object.assign(res, { data: await res.json() }))
				.catch(() => null)
			`;
			},
		},
		{
			oldBind: '$.options',
			replaceFn: (args) => {
				const url = args.length > 0 && args[0];
				const options = createOptions({
					oldOptions: args[1],
					method: 'OPTIONS',
				});
				return dedent.withOptions({ alignValues: true })`
			fetch(${url.text()}, ${options})
				.then(async (res) => Object.assign(res, { data: await res.json() }))
				.catch(() => null)
			`;
			},
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

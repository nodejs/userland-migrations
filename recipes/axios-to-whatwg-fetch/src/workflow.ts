import dedent from 'dedent';
import { EOL } from 'node:os';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { removeBinding } from '@nodejs/codemod-utils/ast-grep/remove-binding';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import type {
	Edit,
	Range,
	Rule,
	SgNode,
	SgRoot,
} from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

type BindingToReplace = {
	rule: Rule<Js>;
	node: SgNode<Js>;
	binding: string;
	replaceFn: (arg: SgNode<Js>[]) => string;
};

type CreateOptionsType = {
	oldOptions?: SgNode<Js>;
	method?: string;
	body?: string;
};

const unsupportedMethods = ['postForm', 'putForm', 'patchForm'];

const getObjectPropertyValue = (
	objectNode: SgNode<Js>,
	propertyName: string,
) => {
	if (objectNode.kind() !== 'object') return undefined;
	const pair = objectNode.find({
		rule: {
			kind: 'pair',
			has: {
				kind: 'property_identifier',
				field: 'key',
				regex: `^${propertyName}$`,
			},
		},
	});

	return pair?.field('value');
};

const stripWrappingQuotes = (value: string) => {
	const trimmed = value.trim();
	if (
		(trimmed.startsWith("'") && trimmed.endsWith("'")) ||
		(trimmed.startsWith('"') && trimmed.endsWith('"'))
	) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
};

const updates: { oldBind: string; replaceFn: BindingToReplace['replaceFn'] }[] =
	[
		/*{
			It's should be migratable with codemod but not supported for now
			oldBind: '$.request',
			replaceFn: (arg) => `console.log(${arg})`,
		},*/
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
		{
			oldBind: 'axios.request',
			replaceFn: (args) => {
				const config = args[0];
				if (!config) {
					console.warn(
						'[Codemod] Missing config object in axios.request. Skipping migration.',
					);
					return '';
				}

				if (config.kind() !== 'object') {
					console.warn(
						'[Codemod] Unsupported axios.request configuration shape. Skipping migration.',
					);
					return '';
				}

				const urlNode = getObjectPropertyValue(config, 'url');
				if (!urlNode) {
					console.warn(
						'[Codemod] Missing URL in axios.request config. Skipping migration.',
					);
					return '';
				}
				const url = urlNode.text();

				const methodNode = getObjectPropertyValue(config, 'method');
				let method = methodNode?.text();
				if (method) {
					method = stripWrappingQuotes(method);
					if (methodNode.kind() === 'string') {
						method = method.toUpperCase();
					}
				}
				if (!method) {
					method = 'GET';
				}

				const dataNode = getObjectPropertyValue(config, 'data');
				const data = dataNode?.text() || null;

				const options = createOptions({
					oldOptions: config,
					method,
					body: data,
				});

				return dedent.withOptions({ alignValues: true })`
		fetch(${url}${options ? `, ${options}` : ''})
			.then(async (res) => Object.assign(res, { data: await res.json() }))
			.catch(() => null)
	`;
			},
		},
	];

/**
 * Generates options for the Fetch API based on the provided parameters.
 *
 * @param {Object} param0 - The parameters for creating options.
 * @param {SgNode<Js>} [param0.oldOptions] - The old options node to extract headers from.
 * @param {string} [param0.method] - The HTTP method to use (e.g., 'POST', 'GET').
 * @param {string} [param0.body] - The body content to include in the request.
 * @returns {string} The generated options string for the Fetch API.
 */
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
		${options.join(`,${EOL}`)}
	}`;
};

/**
 * Transforms the AST root by replacing axios bindings with Fetch API calls.
 *
 * @param {SgRoot<Js>} root - The root of the AST to transform.
 * @returns {string | null} The transformed source code or null if no changes were made.
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];
	const bindsToReplace: BindingToReplace[] = [];

	const importRequireStatement = [
		...getNodeRequireCalls(root, 'axios'),
		...getNodeImportStatements(root, 'axios'),
	];

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

			if (unsupportedMethods.includes(bind.binding.split('.').at(-1))) {
				console.warn(
					'Un-migratable method has been found. Please revise this part of the code.',
				);
				continue;
			}

			const replace = match.replace(bind.replaceFn(args));
			edits.push(replace);

			const result = removeBinding(bind.node, bind.binding.split('.').at(0));

			if (result?.lineToRemove) {
				linesToRemove.push(result.lineToRemove);
			}

			if (result?.edit) {
				edits.push(result.edit);
			}
		}
	}

	if (!edits.length) return null;

	const sourceCode = rootNode.commitEdits(edits);

	return removeLines(sourceCode, linesToRemove);
}

import dedent from 'dedent';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import {
	getNodeImportCalls,
	getNodeImportStatements,
} from '@nodejs/codemod-utils/ast-grep/import-statement';
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
	replaceFn: (arg: SgNode<Js>[], context: WarningContext) => string;
};

type WarningContext = {
	root: SgRoot<Js>;
	match: SgNode<Js>;
};

type CreateOptionsType = {
	oldOptions?: SgNode<Js>;
	method?: string;
	bodyNode?: SgNode<Js> | null;
	payloadKind?: 'json' | 'form';
};

let currentEol = '\n';

const detectEol = (source: string) => (source.includes('\r\n') ? '\r\n' : '\n');

const formatLocation = ({
	root,
	node,
}: {
	root: SgRoot<Js>;
	node: SgNode<Js>;
}) => {
	const { line, column } = node.range().start;
	return `${root.filename()}:${line + 1}:${column + 1}`;
};

const warnWithLocation = (
	context: WarningContext,
	message: string,
	node?: SgNode<Js>,
) => {
	const location = formatLocation({
		root: context.root,
		node: node ?? context.match,
	});
	console.warn(`[Codemod] ${message} (at ${location})`);
};

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

const getBodyExpression = (
	bodyNode: SgNode<Js>,
	payloadKind: NonNullable<CreateOptionsType['payloadKind']>,
) => {
	const source = bodyNode.text();
	const trimmed = source.trim();
	if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null;

	if (payloadKind === 'form') {
		return getFormBodyExpression(bodyNode, source, trimmed);
	}

	return `JSON.stringify(${source})`;
};

const getFormBodyExpression = (
	bodyNode: SgNode<Js>,
	source: string,
	trimmed: string,
) => {
	if (bodyNode.kind() === 'object') {
		return `new URLSearchParams(${source})`;
	}

	// if it's already a FormData or URLSearchParams instance, return as is
	// we only check for common instantiation patterns here maybe add complex ones later
	if (
		trimmed.startsWith('new URLSearchParams') ||
		trimmed.startsWith('URLSearchParams(')
	) {
		return source;
	}

	if (/FormData/.test(trimmed)) {
		return source;
	}

	return dedent`
	(() => {
		const value = ${source};
		if (value instanceof FormData || value instanceof URLSearchParams) return value;
		return new URLSearchParams(value);
	})()
	`;
};

const baseUpdates: {
	oldBind: string;
	replaceFn: BindingToReplace['replaceFn'];
	supportDefaultAccess?: boolean;
}[] = [
	{
		oldBind: '$.get',
		replaceFn: (args, context) => {
			const [url, oldOptions] = args;
			if (!url) {
				warnWithLocation(context, 'Missing URL in axios.get. Skipping.');
				return '';
			}
			const options = createOptions({ oldOptions });
			return dedent.withOptions({ alignValues: true })`
		fetch(${url.text()}${options ? `, ${options}` : ''})
			.then(async (res) => Object.assign(res, { data: await res.json() }))
			.catch(() => null)
		`;
		},
	},
	{
		oldBind: '$.post',
		replaceFn: (args, context) => {
			const url = args[0];
			if (!url) {
				warnWithLocation(context, 'Missing URL in axios.post. Skipping.');
				return '';
			}
			const options = createOptions({
				oldOptions: args[2],
				method: 'POST',
				bodyNode: args[1] ?? null,
				payloadKind: 'json',
			});
			return dedent.withOptions({ alignValues: true })`
		fetch(${url.text()}${options ? `, ${options}` : ''})
			.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
			.catch(() => null)
		`;
		},
	},
	{
		oldBind: '$.put',
		replaceFn: (args, context) => {
			const url = args[0];
			if (!url) {
				warnWithLocation(context, 'Missing URL in axios.put. Skipping.');
				return '';
			}
			const options = createOptions({
				oldOptions: args[2],
				method: 'PUT',
				bodyNode: args[1] ?? null,
				payloadKind: 'json',
			});
			return dedent.withOptions({ alignValues: true })`
		fetch(${url.text()}${options ? `, ${options}` : ''})
			.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
			.catch(() => null)
		`;
		},
	},
	{
		oldBind: '$.patch',
		replaceFn: (args, context) => {
			const url = args[0];
			if (!url) {
				warnWithLocation(context, 'Missing URL in axios.patch. Skipping.');
				return '';
			}
			const options = createOptions({
				oldOptions: args[2],
				method: 'PATCH',
				bodyNode: args[1] ?? null,
				payloadKind: 'json',
			});
			return dedent.withOptions({ alignValues: true })`
		fetch(${url.text()}${options ? `, ${options}` : ''})
			.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
			.catch(() => null)
		`;
		},
	},
	{
		oldBind: '$.postForm',
		replaceFn: (args, context) => {
			const url = args[0];
			if (!url) {
				warnWithLocation(context, 'Missing URL in axios.postForm. Skipping.');
				return '';
			}
			const options = createOptions({
				oldOptions: args[2],
				method: 'POST',
				bodyNode: args[1] ?? null,
				payloadKind: 'form',
			});
			return dedent.withOptions({ alignValues: true })`
		fetch(${url.text()}${options ? `, ${options}` : ''})
			.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
			.catch(() => null)
		`;
		},
	},
	{
		oldBind: '$.putForm',
		replaceFn: (args, context) => {
			const url = args[0];
			if (!url) {
				warnWithLocation(context, 'Missing URL in axios.putForm. Skipping.');
				return '';
			}
			const options = createOptions({
				oldOptions: args[2],
				method: 'PUT',
				bodyNode: args[1] ?? null,
				payloadKind: 'form',
			});
			return dedent.withOptions({ alignValues: true })`
		fetch(${url.text()}${options ? `, ${options}` : ''})
			.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
			.catch(() => null)
		`;
		},
	},
	{
		oldBind: '$.patchForm',
		replaceFn: (args, context) => {
			const url = args[0];
			if (!url) {
				warnWithLocation(context, 'Missing URL in axios.patchForm. Skipping.');
				return '';
			}
			const options = createOptions({
				oldOptions: args[2],
				method: 'PATCH',
				bodyNode: args[1] ?? null,
				payloadKind: 'form',
			});
			return dedent.withOptions({ alignValues: true })`
		fetch(${url.text()}${options ? `, ${options}` : ''})
			.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
			.catch(() => null)
		`;
		},
	},
	{
		oldBind: '$.delete',
		replaceFn: (args, context) => {
			const url = args[0];
			if (!url) {
				warnWithLocation(context, 'Missing URL in axios.delete. Skipping.');
				return '';
			}
			const options = createOptions({
				oldOptions: args[1],
				method: 'DELETE',
			});
			return dedent.withOptions({ alignValues: true })`
		fetch(${url.text()}, ${options})
			.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
			.catch(() => null)
		`;
		},
	},
	{
		oldBind: '$.head',
		replaceFn: (args, context) => {
			const url = args[0];
			if (!url) {
				warnWithLocation(context, 'Missing URL in axios.head. Skipping.');
				return '';
			}
			const options = createOptions({
				oldOptions: args[1],
				method: 'HEAD',
			});
			return dedent.withOptions({ alignValues: true })`
		fetch(${url.text()}, ${options})
			.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
			.catch(() => null)
		`;
		},
	},
	{
		oldBind: '$.options',
		replaceFn: (args, context) => {
			const url = args[0];
			if (!url) {
				warnWithLocation(context, 'Missing URL in axios.options. Skipping.');
				return '';
			}
			const options = createOptions({
				oldOptions: args[1],
				method: 'OPTIONS',
			});
			return dedent.withOptions({ alignValues: true })`
		fetch(${url.text()}, ${options})
			.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
			.catch(() => null)
		`;
		},
	},
	{
		oldBind: '$.request',
		replaceFn: (args, context) => {
			const config = args[0];
			if (!config) {
				warnWithLocation(
					context,
					'Missing config object in axios.request. Skipping.',
				);
				return '';
			}

			if (config.kind() !== 'object') {
				warnWithLocation(
					context,
					'Unsupported axios.request configuration shape. Skipping migration.',
					config,
				);
				return '';
			}

			const urlNode = getObjectPropertyValue(config, 'url');
			if (!urlNode) {
				warnWithLocation(
					context,
					'Missing URL in axios.request config. Skipping migration.',
					config,
				);
				return '';
			}
			const url = urlNode.text();

			const methodNode = getObjectPropertyValue(config, 'method');

			const method = methodNode.child(1)?.text().toUpperCase();

			const options = createOptions({
				oldOptions: config,
				method: method ?? 'GET', // axios.request's default is GET
				bodyNode: getObjectPropertyValue(config, 'data') ?? null,
				payloadKind: 'json',
			});

			return dedent.withOptions({ alignValues: true })`
	fetch(${url}${options ? `, ${options}` : ''})
		.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
		.catch(() => null)
	`;
		},
	},
];

const updates = baseUpdates.flatMap((update) => {
	const bindings = [update.oldBind];
	if (
		update.supportDefaultAccess !== false &&
		!update.oldBind.includes('.default.')
	) {
		bindings.push(update.oldBind.replace('$.', '$.default.'));
	}

	return bindings.map((binding) => ({
		oldBind: binding,
		replaceFn: update.replaceFn,
	}));
});

/**
 * Generates options for the Fetch API based on the provided parameters.
 *
 * @param {Object} param0 - The parameters for creating options.
 * @param {SgNode<Js>} [param0.oldOptions] - The old options node to extract headers from.
 * @param {string} [param0.method] - The HTTP method to use (e.g., 'POST', 'GET').
 * @param {string} [param0.body] - The body content to include in the request.
 * @returns {string} The generated options string for the Fetch API.
 */
const createOptions = ({
	oldOptions,
	method,
	bodyNode,
	payloadKind = 'json',
}: CreateOptionsType) => {
	const bodySource = bodyNode?.text();
	const hasBody = Boolean(bodySource?.trim());
	if (!oldOptions && !method && !hasBody) return '';

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

	// Build the options object string with proper formatting
	const optionParts: string[] = [];

	if (method) {
		optionParts.push(`\tmethod: "${method}"`);
	}

	if (headers) {
		optionParts.push(`\theaders: ${headers.text()}`);
	}

	if (bodyNode) {
		const bodyExpression = getBodyExpression(bodyNode, payloadKind);
		if (bodyExpression) {
			// Indent multi-line body expressions properly
			const indentedBody = bodyExpression
				.split(currentEol)
				.map((line, i) => (i === 0 ? line : `\t${line}`))
				.join(currentEol);
			optionParts.push(`\tbody: ${indentedBody}`);
		}
	}

	if (optionParts.length === 0) return '';

	if (optionParts.length === 1) {
		// Extract the property without leading tab for single-property objects
		const property = optionParts[0].trim();
		return `{ ${property} }`;
	}

	// Multi-line formatting with proper dedent
	return `{${currentEol}${optionParts.join(`,${currentEol}`)}${currentEol}}`;
};

/**
 * Transforms the AST root by replacing axios bindings with Fetch API calls.
 *
 * @param {SgRoot<Js>} root - The root of the AST to transform.
 * @returns {string | null} The transformed source code or null if no changes were made.
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	currentEol = detectEol(rootNode.text());
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];
	const bindsToReplace: BindingToReplace[] = [];

	const importRequireStatement = [
		...getNodeRequireCalls(root, 'axios'),
		...getNodeImportStatements(root, 'axios'),
		...getNodeImportCalls(root, 'axios'),
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

			const replace = match.replace(bind.replaceFn(args, { root, match }));
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

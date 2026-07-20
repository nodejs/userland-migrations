import { EOL } from 'node:os';
import { useMetricAtom } from 'codemod:metrics';
import type {
  Edit,
  Range,
  Rule,
  SgNode,
  SgRoot,
  Codemod
} from 'codemod:ast-grep';
import type Js from 'codemod:ast-grep/langs/javascript';
import dedent from 'dedent';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { removeBinding } from '@nodejs/codemod-utils/ast-grep/remove-binding';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';

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

type AxiosMethodUpdateConfig = {
	name: string;
	method?: string;
	oldOptionsIndex: number;
	bodyIndex?: number;
	payloadKind?: NonNullable<CreateOptionsType['payloadKind']>;
	responseAlias?: string;
	optionalOptionsArg?: boolean;
};

const migrationMetric = useMetricAtom('axios-to-fetch-migrations');
const skippedMetric = useMetricAtom('axios-to-fetch-skipped');
const filesMetric = useMetricAtom('axios-to-fetch-files');

const formatLocation = (root: SgRoot<Js>, node: SgNode<Js>) => {
  const { line, column } = node.range().start;
  return `${root.filename()}:${line + 1}:${column + 1}`;
};

const warnWithLocation = (
  context: WarningContext,
  message: string,
  node?: SgNode<Js>,
) => {
  const location = formatLocation(context.root, node ?? context.match);
  console.warn(`[Codemod] ${message} (at ${location})`);
};

const UNSUPPORTED_CONFIG_OPTIONS = [
  'beforeRedirect',
  'cancelToken',
  'decompress',
  'httpAgent',
  'httpsAgent',
  'maxBodyLength',
  'maxContentLength',
  'maxRedirects',
  'paramsSerializer',
  'signal',
  'socketPath',
  'timeout',
  'transformRequest',
  'transformResponse',
  'validateStatus',
  'withCredentials',
] as const;

const getObjectPropertyValue = ( objectNode: SgNode<Js>, propertyName: string ) => {
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

const hasUnsupportedOptions =
	(configNode: SgNode<Js> | undefined ): { unsupported: boolean; optionName?: string } => {
	if (!configNode || configNode.kind() !== 'object') {
		return { unsupported: false };
	}

	for (const optionName of UNSUPPORTED_CONFIG_OPTIONS) {
		const option = getObjectPropertyValue(configNode, optionName);
		if (option) {
			return { unsupported: true, optionName };
		}
	}

	return { unsupported: false };
};

const getBodyExpression =
(bodyNode: SgNode<Js>, payloadKind: NonNullable<CreateOptionsType['payloadKind']> ) => {
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

	// if it's already a FormData or URLSearchParams instance, return as-is
	// we only check for common instantiation patterns here—maybe add complex ones later?
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

const createAxiosMethodUpdate = ({
	name,
	method,
	oldOptionsIndex,
	bodyIndex,
	payloadKind = 'json',
	responseAlias = 'resp',
	optionalOptionsArg = true,
}: AxiosMethodUpdateConfig) => ({
	oldBind: `$.${name}`,
	replaceFn: (args: SgNode<Js>[], context: WarningContext) => {
		const url = args[0];
		if (!url) {
		warnWithLocation(context, `Missing URL in axios.${name}. Skipping.`);
		skippedMetric.increment({ method: name, reason: 'missing-url' });
		return '';
		}

		const options = createOptions({
		oldOptions: args[oldOptionsIndex],
		method,
		bodyNode: bodyIndex === undefined ? undefined : (args[bodyIndex] ?? null),
		payloadKind,
		});

		const fetchCall = optionalOptionsArg
		? `fetch(${url.text()}${options ? `, ${options}` : ''})`
		: `fetch(${url.text()}, ${options})`;

		migrationMetric.increment({ method: name });

		return dedent.withOptions({ alignValues: true })`
		${fetchCall}
			.then(async (${responseAlias}) => Object.assign(${responseAlias}, { data: await ${responseAlias}.json() }))
			.catch(() => null)
		`;
	},
});

const axiosMethodUpdates = [
	{ name: 'post', method: 'POST', oldOptionsIndex: 2, bodyIndex: 1 },
	{ name: 'put', method: 'PUT', oldOptionsIndex: 2, bodyIndex: 1 },
	{ name: 'patch', method: 'PATCH', oldOptionsIndex: 2, bodyIndex: 1 },
	{
		name: 'postForm',
		method: 'POST',
		oldOptionsIndex: 2,
		bodyIndex: 1,
		payloadKind: 'form',
	},
	{
		name: 'putForm',
		method: 'PUT',
		oldOptionsIndex: 2,
		bodyIndex: 1,
		payloadKind: 'form',
	},
	{
		name: 'patchForm',
		method: 'PATCH',
		oldOptionsIndex: 2,
		bodyIndex: 1,
		payloadKind: 'form',
	},
	{
		name: 'delete',
		method: 'DELETE',
		oldOptionsIndex: 1,
		optionalOptionsArg: false,
	},
	{
		name: 'head',
		method: 'HEAD',
		oldOptionsIndex: 1,
		optionalOptionsArg: false,
	},
	{
		name: 'options',
		method: 'OPTIONS',
		oldOptionsIndex: 1,
		optionalOptionsArg: false,
	},
] satisfies AxiosMethodUpdateConfig[];

const baseUpdates = [
	createAxiosMethodUpdate({
		name: 'get',
		oldOptionsIndex: 1,
		responseAlias: 'res',
	}),
	...axiosMethodUpdates.map(createAxiosMethodUpdate),
	{
		oldBind: '$.request',
		replaceFn: (args, context) => {
		const config = args[0];
		if (!config) {
			warnWithLocation(
			context,
			'Missing config object in axios.request. Skipping.',
			);
			skippedMetric.increment({ method: 'request', reason: 'missing-config' });
			return '';
		}

		if (config.kind() !== 'object') {
			warnWithLocation(
			context,
			'Unsupported axios.request configuration shape. Skipping migration.',
			config,
			);
			skippedMetric.increment({ method: 'request', reason: 'unsupported-shape' });
			return '';
		}

		const urlNode = getObjectPropertyValue(config, 'url');
		if (!urlNode) {
			warnWithLocation(
			context,
			'Missing URL in axios.request config. Skipping migration.',
			config,
			);
			skippedMetric.increment({ method: 'request', reason: 'missing-url' });
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

		migrationMetric.increment({ method: 'request', httpMethod: method ?? 'GET' });

		return dedent.withOptions({ alignValues: true })`
			fetch(${url}${options ? `, ${options}` : ''})
			.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
			.catch(() => null)
		`;
		},
	},
] satisfies {
	oldBind: string;
	replaceFn: BindingToReplace['replaceFn'];
	supportDefaultAccess?: boolean;
}[];

const updates = baseUpdates.flatMap((update) => {
  const bindings = [update.oldBind];
  if (
    // supportDefaultAccess is optional on some update items, so guard access
    (!('supportDefaultAccess' in update) ||
      update.supportDefaultAccess !== false) &&
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
			.split(EOL)
			.map((line, i) => (i === 0 ? line : `\t${line}`))
			.join(EOL);
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
	return `{${EOL}${optionParts.join(`,${EOL}`)}${EOL}}`;
};

/**
 * Checks if any axios calls in the file use unsupported configuration options.
 * If found, logs a warning and returns true to indicate the file should be skipped.
 */
const checkForUnsupportedOptions = (
	rootNode: SgNode<Js>,
	bindsToReplace: BindingToReplace[],
	root: SgRoot<Js>,
): boolean => {
	for (const bind of bindsToReplace) {
		const matches = rootNode.findAll({
		rule: bind.rule,
		});

		for (const match of matches) {
			const argsAndCommaas = match.getMultipleMatches('ARG');
			const args = argsAndCommaas.filter((arg) => arg.text() !== ',');

			// Check axios.request() - first arg should be config object
			if (bind.binding.endsWith('.request')) {
				const config = args[0];
				const unsupported = hasUnsupportedOptions(config);
				if (unsupported.unsupported) {
				warnWithLocation(
					{ root, match },
					`Unsupported axios configuration option '${unsupported.optionName}' detected in axios.request. Skipping migration to preserve functionality.`,
					config,
				);
				skippedMetric.increment({
					method: 'request',
					reason: 'unsupported-option',
					option: unsupported.optionName ?? 'unknown',
				});
				return true;
				}
			} else {
				// For other methods (get, post, put, patch, delete, head, options)
				// Determine option index based on method
				let optionIndex = 1;
				if (
					bind.binding.endsWith('.post') ||
					bind.binding.endsWith('.put') ||
					bind.binding.endsWith('.patch') ||
					bind.binding.endsWith('.postForm') ||
					bind.binding.endsWith('.putForm') ||
					bind.binding.endsWith('.patchForm')
				) {
					optionIndex = 2;
				}

				const config = args[optionIndex];
				const unsupported = hasUnsupportedOptions(config);
				if (unsupported.unsupported) {
					const methodName = bind.binding.split('.').pop();
					warnWithLocation(
						{ root, match },
						`Unsupported axios configuration option '${unsupported.optionName}' detected in axios.${methodName}. Skipping migration to preserve functionality.`,
						config,
					);
					skippedMetric.increment({
						method: methodName ?? 'unknown',
						reason: 'unsupported-option',
						option: unsupported.optionName ?? 'unknown',
					});
					return true;
				}
			}
		}
	}

	return false;
};

const codemod:  Codemod<Js> = async (root: SgRoot<Js>,) => {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];
	const bindsToReplace: BindingToReplace[] = [];

	const importRequireStatement = getModuleDependencies(root, 'axios');

	if (!importRequireStatement.length) return null;

	filesMetric.increment({ status: 'has-axios-import' });

	for (const node of importRequireStatement) {
		for (const update of updates) {
			const bind = resolveBindingPath(node, update.oldBind);

			if (!bind) continue;

			bindsToReplace.push({
				rule: { pattern: `${bind}($$$ARG)` },
				node,
				binding: bind,
				replaceFn: update.replaceFn,
			});
		}
	}

	// Check for unsupported options before making any changes
	if (checkForUnsupportedOptions(rootNode, bindsToReplace, root)) {
		warnWithLocation(
			{ root, match: rootNode },
			'One or more axios calls in this file use unsupported configuration options. Skipping migration to preserve functionality.',
		);
		filesMetric.increment({ status: 'skipped-unsupported-options' });

		return null;
	}

	for (const bind of bindsToReplace) {
		const matches = rootNode.findAll({ rule: bind.rule });

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

	if (!edits.length) {
		filesMetric.increment({ status: 'no-changes' });
		return null;
	}

	filesMetric.increment({ status: 'migrated' });

	const sourceCode = rootNode.commitEdits(edits);

	return removeLines(sourceCode, linesToRemove);
}

export default codemod;

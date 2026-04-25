import type { SgRoot, Edit, SgNode, Kinds } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import {
	detectIndentUnit,
	getLineIndent,
} from '@nodejs/codemod-utils/ast-grep/indent';
import { EOL } from 'node:os';

type QueueEvent = {
	event: keyof typeof parsers;
	handler: () => void;
};

const queue: QueueEvent[] = [];

type Pair = {
	before: SgNode<JS, 'pair'> | SgNode<JS, 'spread_element'>;
	after: string;
};

type ExportedValue = {
	node: SgNode<JS, Kinds<JS>>;
	default: Pair;
	named: Pair[] | undefined;
};
const exportedValues: Map<number, ExportedValue> = new Map();

const parsers = {
	parseOptions: (optionsNode: SgNode<JS, Kinds<JS>>) => {
		switch (optionsNode.kind()) {
			case 'object':
				queue.push(
					{
						event: 'defaultExport',
						handler: () => parsers.defaultExport(optionsNode),
					},
					{
						event: 'namedExports',
						handler: () => parsers.namedExports(optionsNode),
					},
					{
						event: 'spreadElements',
						handler: () => parsers.spreadElements(optionsNode),
					},
				);
				break;
			case 'identifier':
				queue.push({
					event: 'resolveVariables',
					handler: () => parsers.resolveVariables(optionsNode),
				});
				break;
			case 'call_expression':
				queue.push({
					event: 'resolveVariables',
					handler: () =>
						parsers.resolveVariables(optionsNode.field('function')),
				});
				break;
		}
	},
	resolveVariables: (node: SgNode<JS, Kinds<JS>>) => {
		const definition = node.definition();
		if (!definition) return;

		switch (definition.node.parent().kind()) {
			case 'variable_declarator': {
				const parent = definition.node.parent<'variable_declarator'>();
				queue.push({
					event: 'parseOptions',
					handler: () => parsers.parseOptions(parent.field('value')),
				});
				break;
			}
			case 'function_declaration': {
				const fnDeclaration = definition.node.parent<'variable_declarator'>();

				const returns = fnDeclaration
					.findAll<'return_statement'>({
						rule: {
							kind: 'return_statement',
						},
					})
					.map((n) => n.child(1));

				for (const ret of returns) {
					if (ret) {
						queue.push({
							event: 'parseOptions',
							handler: () => parsers.parseOptions(ret),
						});
					}
				}

				break;
			}
			default:
				throw new Error('unhandled scenario');
		}
	},
	defaultExport: (node: SgNode<JS, Kinds<JS>>): Edit[] => {
		const edits: Edit[] = [];
		const defaultExport = node.find<'pair'>({
			rule: {
				kind: 'pair',
				has: {
					field: 'key',
					kind: 'property_identifier',
					regex: 'defaultExport',
				},
			},
		});
		if (defaultExport) {
			const change = {
				before: defaultExport,
				after: `default: ${defaultExport?.field('value').text()}`,
			};

			if (!exportedValues.has(node.id())) {
				exportedValues.set(node.id(), {
					node,
					default: change,
					named: [],
				});
				return;
			}

			const n = exportedValues.get(node.id());
			n.default = change;
		}
		return edits;
	},
	namedExports: (node: SgNode<JS, Kinds<JS>>) => {
		const namedExport = node.find<'pair'>({
			rule: {
				kind: 'pair',
				has: {
					field: 'key',
					kind: 'property_identifier',
					regex: 'namedExport',
				},
			},
		});

		if (namedExport) {
			if (!exportedValues.has(node.id())) {
				exportedValues.set(node.id(), {
					node,
					default: undefined,
					named: [],
				});
			}

			const pairs = exportedValues.get(node.id()).named;

			const fieldValueNode = namedExport.field('value');

			if (fieldValueNode.is('identifier')) {
				pairs.push({
					before: namedExport,
					after: `...(${fieldValueNode.text()} || {})`,
				});
			}
			for (const namedPair of fieldValueNode.children()) {
				if (namedPair.is('pair')) {
					pairs.push({
						before: namedPair,
						after: namedPair.text(),
					});
				}
			}
		}
	},
	spreadElements: (node: SgNode<JS, Kinds<JS>>): undefined => {
		const spreadElements = node.findAll<'spread_element'>({
			rule: {
				kind: 'spread_element',
			},
		});

		if (spreadElements) {
			if (!exportedValues.has(node.id())) {
				exportedValues.set(node.id(), {
					node,
					default: undefined,
					named: [],
				});
			}

			const pairs = exportedValues.get(node.id()).named;

			for (const spread of spreadElements) {
				pairs.push({
					before: spread,
					after: spread.text(),
				});
			}
		}
	},
} as const satisfies Record<string, (node: SgNode<JS, Kinds<JS>>) => void>;

export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	const deps = getModuleDependencies(root, 'test');
	let moduleFnCalls: SgNode<JS, 'call_expression'>[] = [];

	if (!deps.length) return null;

	for (const dep of deps) {
		const moduleFn = resolveBindingPath(dep, '$.mock.module');

		const fnCallNodes = rootNode.findAll<'call_expression'>({
			rule: {
				kind: 'call_expression',
				has: {
					any: [
						{
							kind: 'member_expression',
							pattern: moduleFn,
						},
					],
				},
			},
		});

		moduleFnCalls = moduleFnCalls.concat(fnCallNodes);
	}

	for (const moduleFnCall of moduleFnCalls) {
		const argumentsNode = moduleFnCall.field<'arguments'>('arguments');
		const args = argumentsNode.children().filter((node) => node.isNamed());

		if (args.length < 2) continue;
		const optionsArg = args[1];
		queue.push({
			event: 'parseOptions',
			handler: () => parsers.parseOptions(optionsArg),
		});
	}

	const indentUnit = detectIndentUnit(rootNode.text());

	let i = 0;
	while (queue.length > i) {
		const event = queue.at(i);
		event.handler();
		i++;
	}

	for (const [_nodeId, change] of Array.from(exportedValues)) {
		const indentLevel = getLineIndent(
			rootNode.text(),
			change.node.range().start.index,
		);

		const exportsLevel = `${indentLevel}${indentUnit}`;
		const innerExports = `${exportsLevel}${indentUnit}`;

		let newValue = `{${EOL}` + `${exportsLevel}exports: {${EOL}`;

		if (change.default?.after) {
			newValue += `${innerExports}${change.default.after},${EOL}`;
		}

		if (change.named?.length) {
			newValue += `${innerExports}${change.named.map((t) => t.after).join(`,${EOL}${innerExports}`)},${EOL}`;
		}

		newValue += `${exportsLevel}},${EOL}` + `${indentLevel}}`;

		edits.push(change.node.replace(newValue));
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

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
	handler: () => Edit[];
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

type Parsers = {
	parseOptions: (optionsNode: SgNode<JS, Kinds<JS>>) => undefined;
	defaultExport: (node: SgNode<JS, Kinds<JS>>) => Edit[];
	resolveVariables: (node: SgNode<JS, Kinds<JS>>) => undefined;
	namedExports: (optionsNode: SgNode<JS, Kinds<JS>>) => Edit[];
	spreadElements: (node: SgNode<JS, Kinds<JS>>) => undefined;
};

const parsers: Parsers = {
	parseOptions: (optionsNode: SgNode<JS, Kinds<JS>>): undefined => {
		switch (optionsNode.kind()) {
			case 'object':
				queue.unshift({
					event: 'defaultExport',
					handler: () => parsers.defaultExport(optionsNode),
				});
				queue.unshift({
					event: 'namedExports',
					handler: () => parsers.namedExports(optionsNode),
				});
				queue.unshift({
					event: 'spreadElements',
					handler: () => parsers.spreadElements(optionsNode),
				});
			case 'identifier':
				queue.unshift({
					event: 'resolveVariables',
					handler: () => parsers.resolveVariables(optionsNode),
				});
		}
	},
	resolveVariables: (node: SgNode<JS, Kinds<JS>>) => {
		const definition = node.definition();
		if (!definition) return;

		switch (definition.node.parent().kind()) {
			case 'variable_declarator':
				const parent = definition.node.parent<'variable_declarator'>();
				queue.unshift({
					event: 'parseOptions',
					handler: () => parsers.parseOptions(parent.field('value')),
				});
				break;
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
	namedExports: (node: SgNode<JS, Kinds<JS>>): Edit[] => {
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
				if (!namedPair.is('pair')) continue;

				pairs.push({
					before: namedPair,
					after: namedPair.text(),
				});
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
			const pairs = exportedValues.get(node.id()).named;

			for (const spread of spreadElements) {
				pairs.push({
					before: spread,
					after: spread.text(),
				});
			}
		}
	},
};

export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	const deps = getModuleDependencies(root, 'test');
	let moduleFnCalls: SgNode<JS, 'call_expression'>[] = [];

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
		queue.unshift({
			event: 'parseOptions',
			handler: () => parsers.parseOptions(optionsArg),
		});
	}

	const indentUnit = detectIndentUnit(rootNode.text());
	while (queue.length) {
		const event = queue.at(-1);
		event.handler();
		queue.pop();
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

	let sourceCode = rootNode.commitEdits(edits);

	return sourceCode;
}

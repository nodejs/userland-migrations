import type { Codemod, Edit, SgNode, Kinds } from 'codemod:ast-grep';
import type JS from 'codemod:ast-grep/langs/javascript';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import {
	detectIndentUnit,
	getLineIndent,
} from '@nodejs/codemod-utils/ast-grep/indent';
import { EOL } from 'node:os';
import { useMetricAtom } from 'codemod:metrics';

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

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------
// Two atoms total instead of one per event type: each atom renders as one
// table in the UI, so occurrence-level detail is pushed into tag columns
// (`stage`, `kind`) rather than multiplied across separate atoms.
//
// mock-module-events: every parse/rewrite occurrence.
//   stage='options-call'   kind='call'                          mock.module() call queued
//   stage='options-kind'   kind='object'|'identifier'|'call_expression'
//   stage='default-export' kind='default'
//   stage='named-export'   kind='identifier-spread'|'pair'
//   stage='spread-element' kind='spread'
//   stage='rewrite'        kind='node'                          final node replaced
//
// mock-module-files: one row per processed file.
//   status='migrated'|'no-changes'
const eventsMetric = useMetricAtom('mock-module-events');
const filesMetric = useMetricAtom('mock-module-files');

const parsers = {
	parseOptions: (optionsNode: SgNode<JS, Kinds<JS>>) => {
		switch (optionsNode.kind()) {
			case 'object':
				eventsMetric.increment({ stage: 'options-kind', kind: 'object' });
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
				eventsMetric.increment({ stage: 'options-kind', kind: 'identifier' });
				queue.push({
					event: 'resolveVariables',
					handler: () => parsers.resolveVariables(optionsNode),
				});
				break;
			case 'call_expression':
				eventsMetric.increment({
					stage: 'options-kind',
					kind: 'call_expression',
				});
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

			eventsMetric.increment({ stage: 'default-export', kind: 'default' });

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
				eventsMetric.increment({
					stage: 'named-export',
					kind: 'identifier-spread',
				});
			}
			for (const namedPair of fieldValueNode.children()) {
				if (namedPair.is('pair')) {
					pairs.push({
						before: namedPair,
						after: namedPair.text(),
					});
					eventsMetric.increment({ stage: 'named-export', kind: 'pair' });
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
				eventsMetric.increment({ stage: 'spread-element', kind: 'spread' });
			}
		}
	},
} as const satisfies Record<string, (node: SgNode<JS, Kinds<JS>>) => void>;

const transform: Codemod<JS> = async (root) => {
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

		eventsMetric.increment({ stage: 'options-call', kind: 'call' });

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
		eventsMetric.increment({ stage: 'rewrite', kind: 'node' });
	}

	if (!edits.length) {
		filesMetric.increment({ status: 'no-changes' });
		return null;
	}

	filesMetric.increment({ status: 'migrated' });

	return rootNode.commitEdits(edits);
};

export default transform;

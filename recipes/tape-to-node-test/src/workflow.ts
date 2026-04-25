import { EOL } from 'node:os';
import {
	getNodeImportStatements,
	getNodeImportCalls,
} from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import type { SgRoot, SgNode, Edit, Range } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

/**
 * Mapping of Tape assertions to Node.js assert module methods
 */
const ASSERTION_MAPPING = {
	equal: 'strictEqual',
	notEqual: 'notStrictEqual',
	strictEqual: 'strictEqual',
	notStrictEqual: 'notStrictEqual',
	deepEqual: 'deepStrictEqual',
	notDeepEqual: 'notDeepStrictEqual',
	looseEqual: 'equal',
	notLooseEqual: 'notEqual',
	ok: 'ok',
	ifError: 'ifError',
	error: 'ifError',
	throws: 'throws',
	doesNotThrow: 'doesNotThrow',
	match: 'match',
	doesNotMatch: 'doesNotMatch',
	fail: 'fail',
	same: 'deepStrictEqual',
	notSame: 'notDeepStrictEqual',
	// Aliases
	assert: 'ok',
	ifErr: 'ifError',
	iferror: 'ifError',
	equals: 'strictEqual',
	isEqual: 'strictEqual',
	strictEquals: 'strictEqual',
	is: 'strictEqual',
	notEquals: 'notStrictEqual',
	isNotEqual: 'notStrictEqual',
	doesNotEqual: 'notStrictEqual',
	isInequal: 'notStrictEqual',
	notStrictEquals: 'notStrictEqual',
	isNot: 'notStrictEqual',
	not: 'notStrictEqual',
	looseEquals: 'equal',
	notLooseEquals: 'notEqual',
	deepEquals: 'deepStrictEqual',
	isEquivalent: 'deepStrictEqual',
	notDeepEquals: 'notDeepStrictEqual',
	notEquivalent: 'notDeepStrictEqual',
	notDeeply: 'notDeepStrictEqual',
	isNotDeepEqual: 'notDeepStrictEqual',
	isNotDeeply: 'notDeepStrictEqual',
	isNotEquivalent: 'notDeepStrictEqual',
	isInequivalent: 'notDeepStrictEqual',
	deepLooseEqual: 'deepEqual',
	notDeepLooseEqual: 'notDeepEqual',
};

export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];
	let lineOffset = 0;

	const tapeImports = getNodeImportStatements(root, 'tape');
	const tapeRequires = getNodeRequireCalls(root, 'tape');
	const tapeImportCalls = getNodeImportCalls(root, 'tape');

	const modDeps = [
		...tapeImports.map((node) => ({
			node,
			import: `import { test } from 'node:test';${EOL}import assert from 'node:assert';`,
		})),
		...tapeRequires.map((node) => ({
			node,
			import: `const { test } = require('node:test');${EOL}const assert = require('node:assert');`,
		})),
		...tapeImportCalls.map((node) => ({
			node,
			import: `const { test } = await import('node:test');${EOL}const { default: assert } = await import('node:assert');`,
		})),
	];

	if (!modDeps.length) return null;

	let testVarName = 'test';

	// 1. Replace imports
	for (const mod of modDeps) {
		if (mod.node.kind() === 'variable_declarator') {
			mod.node = mod.node.parent();
		}

		const binding = mod.node.find({
			rule: {
				any: [
					{ kind: 'identifier', inside: { kind: 'variable_declarator' } },
					{
						kind: 'identifier',
						inside: { kind: 'import_clause', stopBy: 'end' },
					},
				],
			},
		});

		if (binding) testVarName = binding.text();

		edits.push(mod.node.replace(mod.import));
		lineOffset += mod.import.split(EOL).length - 1;
	}

	const testCalls = rootNode.findAll({
		constraints: {
			METHOD: {
				regex: '^(skip|only)$',
			},
		},
		rule: {
			kind: 'call_expression',
			any: [
				{
					has: {
						field: 'function',
						pattern: testVarName,
					},
				},
				{
					has: {
						field: 'function',
						all: [
							{
								has: {
									field: 'object',
									pattern: testVarName,
								},
							},
							{
								has: {
									field: 'property',
									pattern: '$METHOD',
								},
							},
						],
					},
				},
			],
		},
	});

	// 2. Transform test calls and assertions
	for (const call of testCalls) {
		const func = call.field('function');
		if (func && testVarName !== 'test') {
			if (func.kind() === 'identifier' && func.text() === testVarName) {
				edits.push(func.replace('test'));
			} else if (func.kind() === 'member_expression') {
				const obj = func.field('object');
				if (obj && obj.text() === testVarName) {
					edits.push(obj.replace('test'));
				}
			}
		}

		const args = call.field('arguments');
		if (!args) continue;

		const callback = args
			.children()
			.find(
				(c) =>
					c.kind() === 'arrow_function' || c.kind() === 'function_expression',
			);
		if (callback) {
			const params = callback.field('parameters');
			let tName = 't';
			const paramId = params?.find({ rule: { kind: 'identifier' } });
			if (paramId) {
				tName = paramId.text();
			}

			const body = callback.field('body');
			let usesEndInCallback = false;
			let hasEndCall = false;
			let hasPlanCall = false;
			if (body) {
				const endCalls = body.findAll({
					rule: {
						kind: 'call_expression',
						all: [
							{
								has: {
									field: 'function',
									kind: 'member_expression',
									has: { field: 'object', pattern: tName },
								},
							},
							{
								has: {
									field: 'function',
									kind: 'member_expression',
									has: { field: 'property', regex: '^end$' },
								},
							},
						],
					},
				});

				hasEndCall = endCalls.length > 0;

				for (const endCall of endCalls) {
					let curr = endCall.parent();
					while (curr && curr.id() !== body.id()) {
						if (
							curr.kind() === 'arrow_function' ||
							curr.kind() === 'function_expression' ||
							curr.kind() === 'function_declaration'
						) {
							usesEndInCallback = true;
							break;
						}
						curr = curr.parent();
					}
				}

				hasPlanCall = Boolean(
					body.find({
						rule: {
							kind: 'call_expression',
							all: [
								{
									has: {
										field: 'function',
										kind: 'member_expression',
										has: { field: 'object', pattern: tName },
									},
								},
								{
									has: {
										field: 'function',
										kind: 'member_expression',
										has: { field: 'property', regex: '^plan$' },
									},
								},
							],
						},
					}),
				);
			}

			const isAsync = callback.text().startsWith('async');
			const shouldUseDone = hasEndCall && (usesEndInCallback || hasPlanCall);

			if (shouldUseDone && params) {
				const hasDoneParam = Boolean(
					params.find({ rule: { kind: 'identifier', regex: '^done$' } }),
				);
				if (!hasDoneParam) {
					const text = params.text();
					if (text.startsWith('(') && text.endsWith(')')) {
						edits.push({
							startPos: params.range().end.index - 1,
							endPos: params.range().end.index - 1,
							insertedText: ', done',
						});
					} else {
						edits.push(params.replace(`(${text}, done)`));
					}
				}
			}

			if (body) {
				// Apply assertion transformations first and determine whether they introduced
				// async requirements (e.g., awaiting a subtest).
				const assertionsRequireAsync = transformMethods(
					body,
					tName,
					edits,
					call,
					shouldUseDone,
					linesToRemove,
					lineOffset,
				);

				// Determine if the callback needs to be async.
				// Only add async when the original callback was async, it already contained awaits,
				// or the assertion transformations inserted awaits for subtests.
				const hasAwait = Boolean(
					body.find({ rule: { kind: 'await_expression' } }),
				);
				const needsAsync = isAsync || hasAwait || assertionsRequireAsync;

				if (needsAsync && !isAsync && params) {
					edits.push({
						startPos: callback.range().start.index,
						endPos: params.range().start.index,
						insertedText: 'async ',
					});
				}
			}
		}
	}

	// 3. Handle unsupported tape lifecycle methods using the same switch-based method transform.
	transformMethods(rootNode, testVarName, edits, undefined, false, {
		allowedMethods: new Set(['onfinish', 'onfailure']),
		sourceFileName: root.filename(),
	});

	if (!edits.length) return null;

	return removeLines(rootNode.commitEdits(edits), linesToRemove);
}

/**
 * Transform Tape assertions to Node.js assert module assertions
 *
 * @param node the AST node to transform
 * @param tName the name of the test object (usually 't')
 * @param edits the list of edits to apply
 * @param testCall the AST node of the test function call
 * @param useDone whether to use the done callback for ending tests
 * @param options optional transform controls
 */
function transformMethods(
	node: SgNode<Js>,
	tName: string,
	edits: Edit[],
	testCall?: SgNode<Js>,
	useDone = false,
	linesToRemove: Range[] = [],
	lineOffset = 0,
	options?: {
		allowedMethods?: Set<string>;
		sourceFileName?: string;
	},
): boolean {
	let requiresAsync = false;
	const calls = node.findAll({
		rule: {
			kind: 'call_expression',
			has: {
				field: 'function',
				kind: 'member_expression',
				has: {
					field: 'object',
					pattern: tName,
				},
			},
		},
	});
	const timeoutAfterCalls = calls.filter(
		(call) =>
			call.field('function')?.field('property')?.text() === 'timeoutAfter',
	);

	for (const call of calls) {
		const method = call.field('function')?.field('property')?.text();
		if (!method) continue;
		const normalizedMethod = method.toLowerCase();

		if (
			options?.allowedMethods &&
			!options.allowedMethods.has(normalizedMethod)
		) {
			continue;
		}

		const args = call.field('arguments');
		const func = call.field('function');

		const newMethod =
			ASSERTION_MAPPING[method as keyof typeof ASSERTION_MAPPING];
		if (newMethod) {
			if (func) {
				edits.push(func.replace(`assert.${newMethod}`));
			}
			continue;
		}

		switch (normalizedMethod) {
			case 'onfinish':
			case 'onfailure': {
				const { line, column } = call.range().start;
				const fileName = options?.sourceFileName || node.getRoot().filename();

				console.warn(
					`[Codemod] Warning: ${method} at ${fileName}:${line}:${column} has no direct equivalent in node:test. Please migrate manually.`,
				);

				const lines = call.text().split(/\r?\n/);
				const newText = lines
					.map((line, i) => (i === 0 ? `// TODO: ${line}` : `// ${line}`))
					.join(EOL);
				edits.push(call.replace(newText));
				break;
			}
			case 'notok':
			case 'false':
				// t.false(val, msg) -> assert.ok(!val, msg)
				// t.notOk(val, msg) -> assert.ok(!val, msg)
				if (args) {
					const val = args.child(1); // child(0) is '('
					if (val) {
						edits.push({
							startPos: val.range().start.index,
							endPos: val.range().start.index,
							insertedText: '!',
						});
						const func = call.field('function');
						if (func) edits.push(func.replace('assert.ok'));
					}
				}
				break;
			case 'comment':
				if (func) edits.push(func.replace(`${tName}.diagnostic`));
				break;
			case 'true':
				if (func) edits.push(func.replace('assert.ok'));
				break;
			case 'pass':
				{
					const { line, column } = call.range().start;
					console.warn(
						`[Codemod] Warning: t.pass at ${line}:${column} has no exact equivalent in node:assert/node:test.
						Please migrate manually (e.g. t.diagnostic(message) for informational output, or remove the call).`,
					);

					const lines = call.text().split(/\r?\n/);
					const newText = lines
						.map((line, i) => (i === 0 ? `// TODO: ${line}` : `// ${line}`))
						.concat(
							'// TODO: Manual migration: consider t.diagnostic(message) for informational output, or remove this call.',
						)
						.join(EOL);
					edits.push(call.replace(newText));
				}
				break;
			case 'end':
				if (useDone) {
					edits.push(call.replace('done()'));
				} else {
					edits.push(call.replace(`// ${call.text()}`));
				}
				break;
			case 'test': {
				const alreadyAwaited = call.parent()?.kind() === 'await_expression';
				let shouldAwaitSubtest = false;
				const cb = args
					?.children()
					.find(
						(c) =>
							c.kind() === 'arrow_function' ||
							c.kind() === 'function_expression',
					);
				if (cb) {
					const p = cb.field('parameters');
					let stName = 't';
					const paramId = p?.find({ rule: { kind: 'identifier' } });
					if (paramId) stName = paramId.text();

					const b = cb.field('body');
					const nestedRequiresAsync = b
						? transformMethods(
								b,
								stName,
								edits,
								call,
								false,
								linesToRemove,
								lineOffset,
							)
						: false;
					const subtestHasAwait = Boolean(
						b?.find({ rule: { kind: 'await_expression' } }),
					);
					const subtestIsAsync = cb.text().startsWith('async');
					const subtestNeedsAsync =
						subtestIsAsync || subtestHasAwait || nestedRequiresAsync;

					if (subtestNeedsAsync && !subtestIsAsync && p) {
						edits.push({
							startPos: cb.range().start.index,
							endPos: p.range().start.index,
							insertedText: 'async ',
						});
					}

					shouldAwaitSubtest = subtestNeedsAsync;
				}

				if (shouldAwaitSubtest && !alreadyAwaited) {
					edits.push({
						startPos: call.range().start.index,
						endPos: call.range().start.index,
						insertedText: 'await ',
					});
				}

				requiresAsync = requiresAsync || shouldAwaitSubtest;
				break;
			}
			case 'teardown':
				if (func) edits.push(func.replace(`${tName}.after`));
				break;
			case 'timeoutafter': {
				const isLastTimeoutAfter = timeoutAfterCalls.at(-1)?.id() === call.id();

				const timeoutArg = args?.child(1); // child(0) is '('
				if (timeoutArg) {
					const timeoutVal = timeoutArg.text();
					if (!isLastTimeoutAfter) {
						const parent = call.parent();
						if (parent && parent.kind() === 'expression_statement') {
							edits.push(parent.replace(''));
							linesToRemove.push(shiftRange(parent.range(), lineOffset));
						} else {
							edits.push(call.replace(''));
							linesToRemove.push(shiftRange(call.range(), lineOffset));
						}
						break;
					}

					// Add to test options
					const testArgs = testCall?.field('arguments');
					if (testArgs) {
						const children = testArgs.children();
						// children[0] is '(', children[last] is ')'
						// args are in between.
						// We expect:
						// 1. test('name', cb) -> insert options
						// 2. test('name', opts, cb) -> update options

						// Filter out punctuation to get actual args
						const actualArgs = children.filter(
							(c) => c.isNamed() && !c.is('comment'),
						);

						if (actualArgs.length === 2) {
							// test('name', cb)
							// Insert options as 2nd arg
							const cbArg = actualArgs[1];
							edits.push({
								startPos: cbArg.range().start.index,
								endPos: cbArg.range().start.index,
								insertedText: `{ signal: AbortSignal.timeout(${timeoutVal}) }, `,
							});
							// remove the original timeout call
							const parent = call.parent();
							if (parent && parent.kind() === 'expression_statement') {
								edits.push(parent.replace(''));
								linesToRemove.push(shiftRange(parent.range(), lineOffset));
							} else {
								edits.push(call.replace(''));
								linesToRemove.push(shiftRange(call.range(), lineOffset));
							}
						} else if (actualArgs.length === 3) {
							// test('name', opts, cb)
							const optsArg = actualArgs[1];
							let timeoutApplied = false;

							if (optsArg.kind() === 'object') {
								timeoutApplied = upsertSignalTimeoutOption(
									optsArg,
									timeoutVal,
									edits,
								);
							} else if (optsArg.kind() === 'identifier') {
								timeoutApplied = upsertSignalTimeoutFromIdentifier(
									optsArg,
									timeoutVal,
									edits,
								);
							}

							if (timeoutApplied) {
								const parent = call.parent();
								if (parent && parent.kind() === 'expression_statement') {
									edits.push(parent.replace(''));
									linesToRemove.push(shiftRange(parent.range(), lineOffset));
								} else {
									edits.push(call.replace(''));
									linesToRemove.push(shiftRange(call.range(), lineOffset));
								}
							} else {
								// Options is a variable or expression — replace the timeout call with a TODO comment and warning
								const { line, column } = call.range().start;
								const fileName = node.getRoot().filename();
								console.warn(
									`[Codemod] Warning: Unable to automatically add signal option at ${fileName}:${line}:${column}. Please add it manually.`,
								);
								edits.push(
									call.replace(
										`// TODO(codemod@nodejs/tape-to-node-test): Add signal: AbortSignal.timeout(${timeoutVal}) to test options manually`,
									),
								);
							}
						}
					} else {
						// If we couldn't find the test call args, remove the timeout call
						const parent = call.parent();
						if (parent && parent.kind() === 'expression_statement') {
							edits.push(parent.replace(''));
						} else {
							edits.push(call.replace(''));
						}
					}
				}

				break;
			}
			default:
				console.log(`Warning: Unhandled Tape method: ${method}`);
		}
	}

	return requiresAsync;
}

function shiftRange(range: Range, lineOffset: number): Range {
	return {
		start: {
			...range.start,
			line: range.start.line + lineOffset,
		},
		end: {
			...range.end,
			line: range.end.line + lineOffset,
		},
	};
}

function upsertSignalTimeoutOption(
	optionsObject: SgNode<Js>,
	timeoutVal: string,
	edits: Edit[],
): boolean {
	const props = optionsObject.children().filter((c) => c.kind() === 'pair');
	const signalProp = props.find((p) => p.field('key')?.text() === 'signal');

	if (signalProp) {
		const signalVal = signalProp.field('value');
		if (!signalVal) return false;
		edits.push(signalVal.replace(`AbortSignal.timeout(${timeoutVal})`));
		return true;
	}

	if (props.length > 0) {
		const lastProp = props[props.length - 1];
		edits.push({
			startPos: lastProp.range().end.index,
			endPos: lastProp.range().end.index,
			insertedText: `, signal: AbortSignal.timeout(${timeoutVal})`,
		});
		return true;
	}

	const closingBrace = optionsObject.children().find((c) => c.text() === '}');
	if (!closingBrace) return false;

	edits.push({
		startPos: closingBrace.range().start.index,
		endPos: closingBrace.range().start.index,
		insertedText: ` signal: AbortSignal.timeout(${timeoutVal}) `,
	});

	return true;
}

function upsertSignalTimeoutFromIdentifier(
	optionsIdentifier: SgNode<Js>,
	timeoutVal: string,
	edits: Edit[],
): boolean {
	const definition = optionsIdentifier.definition();
	if (!definition) return false;

	const definitionNode = definition.node;
	const declarator =
		definitionNode.kind() === 'variable_declarator'
			? definitionNode
			: definitionNode
					.ancestors()
					.find((ancestor) => ancestor.kind() === 'variable_declarator');

	if (!declarator) return false;

	const valueNode = declarator.field('value');
	if (!valueNode || valueNode.kind() !== 'object') return false;

	return upsertSignalTimeoutOption(valueNode, timeoutVal, edits);
}

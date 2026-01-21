import { EOL } from 'node:os';
import {
	getNodeImportStatements,
	getNodeImportCalls,
} from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import type { SgRoot, SgNode, Edit } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

/**
 * Mapping of Tape assertions to Node.js assert module methods
 */
const ASSERTION_MAPPING: Record<string, string> = {
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
	}

	const testCalls = rootNode.findAll({
		rule: {
			kind: 'call_expression',
			has: {
				field: 'function',
				regex: `^${testVarName}(\\.(skip|only))?$`,
			},
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
				// Apply assertion transformations first
				transformAssertions(body, tName, edits, call, shouldUseDone);

				// Determine if the callback needs to be async.
				// It must be async if it already is, or if the body contains any await expressions,
				// or if there are subtests (t.test(...)) which we convert to 'await test(...)'.
				const hasAwait = Boolean(
					body.find({ rule: { kind: 'await_expression' } }),
				);
				const hasSubtestCall = Boolean(
					body.find({
						rule: {
							kind: 'call_expression',
							all: [
								{
									has: {
										field: 'function',
										kind: 'member_expression',
									},
								},
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
										has: { field: 'property', regex: '^test$' },
									},
								},
							],
						},
					}),
				);

				// If the callback has a parameter (e.g., TestContext `t`),
				// we keep it async to align with expected behavior unless it already uses done style.
				// For zero-arg callbacks, only add async when truly needed (awaits or subtests).
				const hasParam = Boolean(paramId);
				const needsAsync = hasParam
					? true
					: isAsync || hasAwait || hasSubtestCall;

				if (!usesEndInCallback && !isAsync && needsAsync) {
					if (params) {
						edits.push({
							startPos: callback.range().start.index,
							endPos: params.range().start.index,
							insertedText: 'async ',
						});
					}
				}
			}
		}
	}

	// 3. Handle test.onFinish and test.onFailure
	const lifecycleCalls = rootNode.findAll({
		rule: {
			kind: 'call_expression',
			has: {
				field: 'function',
				regex: `^${testVarName}\\.(onFinish|onFailure)$`,
			},
		},
	});

	for (const call of lifecycleCalls) {
		const { line, column } = call.range().start;
		const fileName = root.filename();
		const methodName =
			call.field('function')?.field('property')?.text() || 'lifecycle method';

		console.warn(
			`[Codemod] Warning: ${methodName} at ${fileName}:${line}:${column} has no direct equivalent in node:test. Please migrate manually.`,
		);

		const lines = call.text().split(/\r?\n/);
		const newText = lines
			.map((line, i) => (i === 0 ? `// TODO: ${line}` : `// ${line}`))
			.join(EOL);
		edits.push(call.replace(newText));
	}

	return rootNode.commitEdits(edits);
}

/**
 * Transform Tape assertions to Node.js assert module assertions
 *
 * @param node the AST node to transform
 * @param tName the name of the test object (usually 't')
 * @param edits the list of edits to apply
 * @param testCall the AST node of the test function call
 * @param useDone whether to use the done callback for ending tests
 */
function transformAssertions(
	node: SgNode<Js>,
	tName: string,
	edits: Edit[],
	testCall: SgNode<Js>,
	useDone = false,
) {
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

	for (const call of calls) {
		const method = call.field('function')?.field('property')?.text();
		if (!method) continue;

		const args = call.field('arguments');
		const func = call.field('function');

		if (ASSERTION_MAPPING[method]) {
			const newMethod = ASSERTION_MAPPING[method];
			if (func) {
				edits.push(func.replace(`assert.${newMethod}`));
			}
			continue;
		}

		switch (method.toLowerCase()) {
			case 'notok':
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
			case 'false':
				if (args) {
					const val = args.child(1);
					if (val) {
						edits.push({
							startPos: val.range().start.index,
							endPos: val.range().start.index,
							insertedText: '!',
						});
						if (func) edits.push(func.replace('assert.ok'));
					}
				}
				break;
			case 'pass':
				if (args) {
					// Insert 'true' as first arg
					// args text is like "('msg')" or "()"
					const openParen = args.child(0);
					if (openParen) {
						edits.push({
							startPos: openParen.range().end.index,
							endPos: openParen.range().end.index,
							insertedText: args.children().length > 2 ? 'true, ' : 'true',
						});
						if (func) edits.push(func.replace('assert.ok'));
					}
				}
				break;
			case 'plan':
				break;
			case 'end':
				if (useDone) {
					edits.push(call.replace('done()'));
				} else {
					edits.push(call.replace(`// ${call.text()}`));
				}
				break;
			case 'test': {
				edits.push({
					startPos: call.range().start.index,
					endPos: call.range().start.index,
					insertedText: 'await ',
				});
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
					if (b) transformAssertions(b, stName, edits, call);

					if (!cb.text().startsWith('async')) {
						if (p) {
							edits.push({
								startPos: cb.range().start.index,
								endPos: p.range().start.index,
								insertedText: 'async ',
							});
						}
					}
				}
				break;
			}
			case 'teardown':
				if (func) edits.push(func.replace(`${tName}.after`));
				break;
			case 'timeoutafter': {
				const timeoutArg = args?.child(1); // child(0) is '('
				if (timeoutArg) {
					const timeoutVal = timeoutArg.text();

					// Add to test options
					const testArgs = testCall.field('arguments');
					if (testArgs) {
						const children = testArgs.children();
						// children[0] is '(', children[last] is ')'
						// args are in between.
						// We expect:
						// 1. test('name', cb) -> insert options
						// 2. test('name', opts, cb) -> update options

						// Filter out punctuation to get actual args
						const actualArgs = children.filter(
							(c) =>
								c.kind() !== '(' &&
								c.kind() !== ')' &&
								c.kind() !== ',' &&
								c.kind() !== 'comment',
						);

						if (actualArgs.length === 2) {
							// test('name', cb)
							// Insert options as 2nd arg
							const cbArg = actualArgs[1];
							edits.push({
								startPos: cbArg.range().start.index,
								endPos: cbArg.range().start.index,
								insertedText: `{ timeout: ${timeoutVal} }, `,
							});
							// remove the original timeout call
							const parent = call.parent();
							if (parent && parent.kind() === 'expression_statement') {
								edits.push(parent.replace(''));
							} else {
								edits.push(call.replace(''));
							}
						} else if (actualArgs.length === 3) {
							// test('name', opts, cb)
							const optsArg = actualArgs[1];
							if (optsArg.kind() === 'object') {
								// Add property to object
								const props = optsArg
									.children()
									.filter((c) => c.kind() === 'pair');
								if (props.length > 0) {
									const lastProp = props[props.length - 1];
									edits.push({
										startPos: lastProp.range().end.index,
										endPos: lastProp.range().end.index,
										insertedText: `, timeout: ${timeoutVal}`,
									});
									// remove the original timeout call
									const parent = call.parent();
									if (parent && parent.kind() === 'expression_statement') {
										edits.push(parent.replace(''));
									} else {
										edits.push(call.replace(''));
									}
								} else {
									// Empty object {}
									// We need to find where to insert.
									// It's safer to replace the whole object if it's empty, or find the closing brace.
									const closingBrace = optsArg
										.children()
										.find((c) => c.text() === '}');
									if (closingBrace) {
										edits.push({
											startPos: closingBrace.range().start.index,
											endPos: closingBrace.range().start.index,
											insertedText: ` timeout: ${timeoutVal} `,
										});
										// remove the original timeout call
										const parent = call.parent();
										if (parent && parent.kind() === 'expression_statement') {
											edits.push(parent.replace(''));
										} else {
											edits.push(call.replace(''));
										}
									}
								}
							} else {
								// Options is a variable or expression — replace the timeout call with a TODO comment and warning
								const { line, column } = call.range().start;
								const fileName = node.getRoot().filename();
								console.warn(
									`[Codemod] Warning: Unable to automatically add timeout option at ${fileName}:${line}:${column}. Please add it manually.`,
								);
								edits.push(
									call.replace(
										`// TODO(codemod@nodejs/tape-to-node-test): Add timeout: \`${timeoutVal}\` to test options manually`,
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
				console.log(`Warning: Unhandled Tape assertion method: ${method}`);
		}
	}
}

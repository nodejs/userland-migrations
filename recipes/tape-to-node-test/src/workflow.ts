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

	if (
		tapeImports.length === 0 &&
		tapeRequires.length === 0 &&
		tapeImportCalls.length === 0
	) {
		return null;
	}

	let testVarName = 'test';

	// 1. Replace imports
	for (const imp of tapeImports) {
		const defaultImport = imp.find({
			rule: { kind: 'import_clause', has: { kind: 'identifier' } },
		});
		if (defaultImport) {
			const id = defaultImport.find({ rule: { kind: 'identifier' } });
			if (id) testVarName = id.text();
			edits.push(
				imp.replace(
					`import { test } from 'node:test';${EOL}import assert from 'node:assert';`,
				),
			);
		}
	}

	for (const req of tapeRequires) {
		const id = req.find({
			rule: { kind: 'identifier', inside: { kind: 'variable_declarator' } },
		});
		if (id) testVarName = id.text();
		const declaration = req
			.ancestors()
			.find(
				(a) =>
					a.kind() === 'variable_declaration' ||
					a.kind() === 'lexical_declaration',
			);
		if (declaration) {
			edits.push(
				declaration.replace(
					`const { test } = require('node:test');${EOL}const assert = require('node:assert');`,
				),
			);
		}
	}

	for (const call of tapeImportCalls) {
		const id = call.find({
			rule: { kind: 'identifier', inside: { kind: 'variable_declarator' } },
		});
		if (id) testVarName = id.text();
		const declaration = call
			.ancestors()
			.find(
				(a) =>
					a.kind() === 'variable_declaration' ||
					a.kind() === 'lexical_declaration',
			);
		if (declaration) {
			edits.push(
				declaration.replace(
					`const { test } = await import('node:test');${EOL}const { default: assert } = await import('node:assert');`,
				),
			);
		}
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
			if (body) {
				const endCalls = body.findAll({
					rule: {
						kind: 'call_expression',
						has: {
							field: 'function',
							kind: 'member_expression',
							has: {
								field: 'object',
								regex: `^${tName}$`,
							},
						},
					},
				});

				for (const endCall of endCalls) {
					let isNested = false;
					let curr = endCall.parent();
					while (curr && curr.id() !== body.id()) {
						if (
							curr.kind() === 'arrow_function' ||
							curr.kind() === 'function_expression' ||
							curr.kind() === 'function_declaration'
						) {
							isNested = true;
							break;
						}
						curr = curr.parent();
					}

					if (isNested) {
						usesEndInCallback = true;
					}
				}
			}

			const isAsync = callback.text().startsWith('async');
			let useDone = false;

			if (usesEndInCallback && !isAsync) {
				useDone = true;
				if (params) {
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
				transformAssertions(body, tName, edits, call, useDone);
			}

			if (!usesEndInCallback && !isAsync) {
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
					regex: `^${tName}$`,
				},
			},
		},
	});

	for (const call of calls) {
		const method = call.field('function')?.field('property')?.text();
		if (!method) continue;

		if (ASSERTION_MAPPING[method]) {
			const newMethod = ASSERTION_MAPPING[method];
			const func = call.field('function');
			if (func) {
				edits.push(func.replace(`assert.${newMethod}`));
			}
		} else if (method === 'notOk' || method === 'notok') {
			// t.notOk(val, msg) -> assert.ok(!val, msg)
			const args = call.field('arguments');
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
		} else if (method === 'comment') {
			// t.comment(msg) -> t.diagnostic(msg)
			const func = call.field('function');
			if (func) edits.push(func.replace(`${tName}.diagnostic`));
		} else if (method === 'true') {
			// t.true(val, msg) -> assert.ok(val, msg)
			const func = call.field('function');
			if (func) edits.push(func.replace('assert.ok'));
		} else if (method === 'false') {
			// t.false(val, msg) -> assert.ok(!val, msg)
			const args = call.field('arguments');
			if (args) {
				const val = args.child(1);
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
		} else if (method === 'pass') {
			// t.pass(msg) -> assert.ok(true, msg)
			const args = call.field('arguments');
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
					const func = call.field('function');
					if (func) edits.push(func.replace('assert.ok'));
				}
			}
		} else if (method === 'plan') {
			edits.push(call.replace(`// ${call.text()}`));
		} else if (method === 'end') {
			if (useDone) {
				edits.push(call.replace('done()'));
			} else {
				edits.push(call.replace(`// ${call.text()}`));
			}
		} else if (method === 'test') {
			edits.push({
				startPos: call.range().start.index,
				endPos: call.range().start.index,
				insertedText: 'await ',
			});

			const args = call.field('arguments');
			const cb = args
				?.children()
				.find(
					(c) =>
						c.kind() === 'arrow_function' || c.kind() === 'function_expression',
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
		} else if (method === 'teardown') {
			const func = call.field('function');
			if (func) {
				edits.push(func.replace(`${tName}.after`));
			}
		} else if (method === 'timeoutAfter') {
			const args = call.field('arguments');
			const timeoutArg = args?.child(1); // child(0) is '('
			if (timeoutArg) {
				const timeoutVal = timeoutArg.text();
				// Remove the call
				const parent = call.parent();
				if (parent && parent.kind() === 'expression_statement') {
					edits.push(parent.replace(''));
				} else {
					edits.push(call.replace(''));
				}

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
								}
							}
						} else {
							// Options is a variable or expression
							// TODO: Handle this case?
							// For now, maybe just log a comment
							edits.push(
								call.replace(
									`// TODO: Add timeout: ${timeoutVal} to test options manually`,
								),
							);
						}
					}
				}
			}
		}
	}
}

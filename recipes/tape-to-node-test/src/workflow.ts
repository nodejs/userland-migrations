import { EOL } from 'node:os';
import {
	getNodeImportStatements,
	getNodeImportCalls,
} from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import type { SgRoot, SgNode, Edit } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

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

	// Replace imports
	for (const imp of tapeImports) {
		const defaultImport = imp.find({
			rule: { kind: 'import_clause', has: { kind: 'identifier' } },
		});
		if (defaultImport) {
			const id = defaultImport.find({ rule: { kind: 'identifier' } });
			if (id) testVarName = id.text();
			edits.push(
				imp.replace(
					`import { test } from 'node:test';${EOL}import assert from 'node:assert/strict';`,
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
					`const { test } = require('node:test');${EOL}const assert = require('node:assert/strict');`,
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
					`const { test } = await import('node:test');${EOL}const { default: assert } = await import('node:assert/strict');`,
				),
			);
		}
	}

	const testCalls = rootNode.findAll({
		rule: {
			kind: 'call_expression',
			has: {
				field: 'function',
				regex: `^${testVarName}$`,
			},
		},
	});

	for (const call of testCalls) {
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
			} else {
				if (!isAsync) {
					if (params) {
						edits.push({
							startPos: callback.range().start.index,
							endPos: params.range().start.index,
							insertedText: 'async ',
						});
					}
				}
			}

			if (body) {
				transformAssertions(body, tName, edits, useDone);
			}
		}
	}

	return rootNode.commitEdits(edits);
}

function transformAssertions(
	node: SgNode<Js>,
	tName: string,
	edits: Edit[],
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
		} else if (method === 'notOk') {
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
				if (!cb.text().startsWith('async')) {
					const p = cb.field('parameters');
					if (p) {
						edits.push({
							startPos: cb.range().start.index,
							endPos: p.range().start.index,
							insertedText: 'async ',
						});
					}
				}
				const p = cb.field('parameters');
				let stName = 't';
				const paramId = p?.find({ rule: { kind: 'identifier' } });
				if (paramId) stName = paramId.text();

				const b = cb.field('body');
				if (b) transformAssertions(b, stName, edits);
			}
		} else if (method === 'teardown') {
			const func = call.field('function');
			if (func) {
				edits.push(func.replace(`${tName}.after`));
			}
		} else if (method === 'timeoutAfter') {
			// t.timeoutAfter(200) -> remove and add to test options?
			// This is hard because we need to modify the parent test call arguments.
			// For now, let's just comment it out and add a TODO.
			edits.push(
				call.replace(`// TODO: Move timeout to test options: ${call.text()}`),
			);
		}
	}
}

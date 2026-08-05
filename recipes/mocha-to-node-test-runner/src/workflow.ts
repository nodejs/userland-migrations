import type { Codemod, Edit, Kinds, SgNode } from 'codemod:ast-grep';
import type JS from 'codemod:ast-grep/langs/javascript';
import isESM from '@nodejs/codemod-utils/is-esm';
import { getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { useMetricAtom } from 'codemod:metrics';

const GLOBAL_IDENTIFIERS = ['describe'];
const USED_GLOBAL_IDENTIFIERS = ['', '.skip', '.only'];

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------
// Tracks the node:test import inserted (by module style), each done-callback
// signature rewritten, each `this.skip()` / `this.timeout()` conversion, and
// a per-file migration summary.

const importMetric = useMetricAtom('mocha-to-node-test-imports');
const doneCallbackMetric = useMetricAtom('mocha-to-node-test-done-callbacks');
const thisSkipMetric = useMetricAtom('mocha-to-node-test-this-skip');
const thisTimeoutMetric = useMetricAtom('mocha-to-node-test-this-timeout');
const filesMetric = useMetricAtom('mocha-to-node-test-files');

function transformImport(rootNode: SgNode<JS>, EOL: string): Edit[] {
	const mochaGlobalsNodes = rootNode.findAll({
		constraints: {
			MOCHA_GLOBAL_FN: {
				any: [
					{ pattern: 'describe' },
					{ pattern: 'it' },
					{ pattern: 'before' },
					{ pattern: 'after' },
					{ pattern: 'beforeEach' },
					{ pattern: 'afterEach' },
					{ pattern: 'describe.skip' },
					{ pattern: 'describe.only' },
					{ pattern: 'it.skip' },
					{ pattern: 'it.only' },
				],
			},
		},
		rule: {
			pattern: '$MOCHA_GLOBAL_FN($$$)',
		},
	});

	const usedMochaGlobals = new Set(
		mochaGlobalsNodes.map(
			(mochaGlobalsNode) =>
				mochaGlobalsNode.getMatch('MOCHA_GLOBAL_FN').text().split('.')[0],
		),
	);

	// if mocha isn't found, don't try to apply changes
	if (usedMochaGlobals.size === 0) return [];

	const esm = isESM(rootNode);

	const existingNodeTestImports = esm
		? getNodeImportStatements(rootNode.getRoot(), 'test')
		: getNodeRequireCalls(rootNode.getRoot(), 'test');
	if (existingNodeTestImports.length > 0) return [];

	const imports = [...usedMochaGlobals].join(', ');

	const insertedText = esm
		? `${EOL}import { ${imports} } from 'node:test';`
		: `${EOL}const { ${imports} } = require('node:test');`;

	importMetric.increment({ style: esm ? 'esm' : 'cjs' });

	if (esm) {
		const importStatements = rootNode.findAll({
			rule: { kind: 'import_statement' },
		});
		const lastImportStatement = importStatements[importStatements.length - 1];
		if (lastImportStatement !== undefined) {
			return [
				{
					startPos: lastImportStatement.range().end.index,
					endPos: lastImportStatement.range().end.index,
					insertedText,
				},
			];
		}
	} else {
		const requireStatements = rootNode.findAll({
			rule: { pattern: 'const $_A = require($_B)' },
		});
		const lastRequireStatements =
			requireStatements[requireStatements.length - 1];
		if (lastRequireStatements !== undefined) {
			return [
				{
					startPos: lastRequireStatements.range().end.index,
					endPos: lastRequireStatements.range().end.index,
					insertedText,
				},
			];
		}
	}
	return [
		{
			startPos: 0,
			endPos: 0,
			insertedText,
		},
	];
}

function transformDoneCallbacks(rootNode: SgNode<JS>, EOL: string): Edit[] {
	return rootNode
		.findAll({
			constraints: {
				DONE: {
					regex: '^done$',
				},
				CALLEE: {
					regex: '^(it|before|after|beforeEach|afterEach)$',
				},
				CALLEE_NO_TITLE: {
					regex: '^(before|after|beforeEach|afterEach)$',
				},
			},
			rule: {
				any: [
					{
						pattern: '$CALLEE($TITLE, function($DONE) { $$$BODY })',
					},
					{
						pattern: '$CALLEE_NO_TITLE(function($DONE) { $$$BODY })',
					},
					{
						pattern: '$CALLEE($TITLE, ($DONE) => { $$$BODY })',
					},
					{
						pattern: '$CALLEE_NO_TITLE(($DONE) => { $$$BODY })',
					},
					{
						pattern: '$CALLEE($TITLE, $DONE => { $$$BODY })',
					},
					{
						pattern: '$CALLEE_NO_TITLE($DONE => { $$$BODY })',
					},
				],
			},
		})
		.map((found) => {
			const callee = found.getMatch('CALLEE')?.text();
			doneCallbackMetric.increment({ callee: callee ?? 'unknown' });
			return found.getMatch('DONE').replace('t, done');
		});
}

function transformThisSkip(rootNode: SgNode<JS>): Edit[] {
	return rootNode
		.findAll({ rule: { pattern: 'this.skip($$$)' } })
		.flatMap((call) => {
			const edits: Edit[] = [];
			const memberExpr = call.find({
				rule: { kind: 'member_expression', has: { kind: 'this' } },
			});
			const thisKeyword = memberExpr?.field('object');
			if (thisKeyword) edits.push(thisKeyword.replace('t'));

			const fn = findEnclosingFunction(call);
			if (!fn) return edits;

			const params = getParameters(fn);
			if (!params) return edits;

			edits.push(...addTParameter(params));

			if (edits.length) thisSkipMetric.increment({});

			return edits;
		});
}

function transformThisTimeout(rootNode: SgNode<JS>, EOL: string): Edit[] {
	const source = rootNode.text();

	return rootNode
		.findAll({ rule: { pattern: 'this.timeout($TIME)' } })
		.flatMap((call) => {
			const edits: Edit[] = [];
			const expr = call.parent();
			const exprRange = expr.range();

			const start = exprRange.start.index;
			const end = exprRange.end.index;
			const lineStart = findLineStart(source, start);
			const lineEnd = findLineEnd(source, end);

			edits.push({
				startPos: lineStart,
				endPos: lineEnd,
				insertedText: '',
			});

			const fn = findEnclosingFunction(call);
			if (!fn) {
				thisTimeoutMetric.increment({ appliedToEnclosingFn: false });
				return edits;
			}

			const time = call.getMatch('TIME').text();
			const fnRange = fn.range();

			edits.push({
				startPos: fnRange.start.index,
				endPos: fnRange.start.index,
				insertedText: `{ timeout: ${time} }, `,
			});

			thisTimeoutMetric.increment({ appliedToEnclosingFn: "true" });

			return edits;
		});
}

function findLineStart(source: string, index: number) {
	const lineBreakIndex = source.lastIndexOf('\n', index - 1);
	return lineBreakIndex === -1 ? 0 : lineBreakIndex + 1;
}

function findLineEnd(source: string, index: number) {
	let lineEnd = index;
	while (lineEnd < source.length && source[lineEnd] !== '\n' && source[lineEnd] !== '\r') {
		lineEnd++;
	}

	if (source[lineEnd] === '\r' && source[lineEnd + 1] === '\n') {
		return lineEnd + 2;
	}

	if (source[lineEnd] === '\n' || source[lineEnd] === '\r') {
		return lineEnd + 1;
	}

	return lineEnd;
}

function findEnclosingFunction(node: SgNode<JS, Kinds<JS>>) {
	return node
		.ancestors()
		.find((a: SgNode<JS, Kinds<JS>>) =>
			['function_expression', 'arrow_function'].includes(a.kind()),
		);
}

function getParameters(fn: SgNode<JS, Kinds<JS>>) {
	return fn.field('parameters') ?? fn.field('parameter');
}

function addTParameter(parameters: SgNode<JS, Kinds<JS>>): Edit[] {
	const edits: Edit[] = [];

	if (parameters.kind() === 'identifier') {
		edits.push(parameters.replace(`(t, ${parameters.text()})`));
	} else if (parameters.kind() === 'formal_parameters') {
		edits.push({
			startPos: parameters.range().start.index + 1,
			endPos: parameters.range().start.index + 1,
			insertedText: `t${parameters.children().length > 2 ? ', ' : ''}`,
		});
	}

	return edits;
}

const transform: Codemod<JS> = async (root) => {
	const rootNode = root.root();
	const EOL = rootNode.text().includes('\r\n') ? '\r\n' : '\n';

	const usedGlobalIdentifiers = GLOBAL_IDENTIFIERS.filter((globalIdentifier) =>
		USED_GLOBAL_IDENTIFIERS.map(
			(suffix) => `${globalIdentifier}${suffix}($$$)`,
		).some((pattern) => rootNode.findAll({ rule: { pattern } }).length > 0),
	);

	if (!usedGlobalIdentifiers.length) return null;

	const edits = [
		transformImport,
		transformDoneCallbacks,
		transformThisSkip,
		transformThisTimeout,
	].flatMap((transform) => transform(rootNode, EOL));

	if (!edits.length) {
		filesMetric.increment({ status: 'no-changes' });
		return null;
	}

	filesMetric.increment({ status: 'migrated' });

	return rootNode.commitEdits(edits);
}

export default transform;

import isESM from '@nodejs/codemod-utils/is-esm';
import { getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import type { Edit, Kinds, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';
import { EOL } from 'node:os';

const GLOBAL_IDENTIFIERS = ['describe'];
const USED_GLOBAL_IDENTIFIERS = ['', '.skip', '.only'];

export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();

	const usedGlobalIdentifiers = GLOBAL_IDENTIFIERS.filter((globalIdentifier) =>
		USED_GLOBAL_IDENTIFIERS.map(
			(suffix) => `${globalIdentifier}${suffix}($$$)`,
		).some((pattern) => rootNode.findAll({ rule: { pattern } }).length > 0),
	);

	if (usedGlobalIdentifiers.length === 0) return null;

	const edits = [
		transformImport,
		transformDoneCallbacks,
		transformThisSkip,
		transformThisTimeout,
	].flatMap((transform) => transform(root));
	if (edits.length === 0) return null;

	return rootNode.commitEdits(edits);
}

function transformImport(root: SgRoot<JS>): Edit[] {
	const rootNode = root.root();
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

	const usedMochaGlobals = [
		...new Set(
			mochaGlobalsNodes.map(
				(mochaGlobalsNode) =>
					mochaGlobalsNode.getMatch('MOCHA_GLOBAL_FN').text().split('.')[0],
			),
		),
	];

	// if mocha isn't found, don't try to apply changes
	if (usedMochaGlobals.length === 0) return [];

	const esm = isESM(root);

	const existingNodeTestImports = esm
		? getNodeImportStatements(rootNode.getRoot(), 'test')
		: getNodeRequireCalls(rootNode.getRoot(), 'test');
	if (existingNodeTestImports.length > 0) return [];

	const imports = usedMochaGlobals.join(', ');

	const insertedText = esm
		? `${EOL}import { ${imports} } from 'node:test';`
		: `${EOL}const { ${imports} } = require('node:test');`;

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

function transformDoneCallbacks(root: SgRoot<JS>): Edit[] {
	return root
		.root()
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
		.map((found) => found.getMatch('DONE').replace('t, done'));
}

function transformThisSkip(root: SgRoot<JS>): Edit[] {
	return root
		.root()
		.findAll({ rule: { pattern: 'this.skip($$$)' } })
		.flatMap((call) => {
			const edits: Edit[] = [];
			const memberExpr = call.find({
				rule: { kind: 'member_expression', has: { kind: 'this' } },
			});
			const thisKeyword = memberExpr?.field('object');
			if (thisKeyword) {
				edits.push(thisKeyword.replace('t'));
			}

			const fn = findEnclosingFunction(call);
			if (!fn) {
				return edits;
			}

			const params = getParameters(fn);
			if (!params) return edits;

			edits.push(...addTParameter(params));

			return edits;
		});
}

function transformThisTimeout(root: SgRoot<JS>): Edit[] {
	const rootNode = root.root();
	const source = rootNode.text();

	return rootNode
		.findAll({ rule: { pattern: 'this.timeout($TIME)' } })
		.flatMap((call) => {
			const edits: Edit[] = [];
			const expr = call.parent();

			const start = expr.range().start.index;
			const end = expr.range().end.index;
			let lineStart = start;
			while (lineStart > 0 && source[lineStart - 1] !== EOL) lineStart--;

			let lineEnd = end;
			while (lineEnd < source.length && source[lineEnd] !== EOL) lineEnd++;
			if (lineEnd < source.length) lineEnd++;

			edits.push({
				startPos: lineStart,
				endPos: lineEnd,
				insertedText: '',
			});

			const fn = findEnclosingFunction(call);
			if (!fn) return edits;

			const time = call.getMatch('TIME').text();

			edits.push({
				startPos: fn.range().start.index,
				endPos: fn.range().start.index,
				insertedText: `{ timeout: ${time} }, `,
			});

			return edits;
		});
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

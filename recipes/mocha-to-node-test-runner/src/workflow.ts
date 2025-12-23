import isESM from '@nodejs/codemod-utils/is-esm';
import { getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import type { Edit, SgRoot } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';

export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();

	const globalIdentifiers = ['describe'];

	const usedGlobalIdentifiers = globalIdentifiers.filter((globalIdentifier) =>
		['', '.skip', '.only']
			.map((suffix) => `${globalIdentifier}${suffix}($$$)`)
			.some((pattern) => rootNode.findAll({ rule: { pattern } }).length > 0),
	);

	if (usedGlobalIdentifiers.length === 0) return null;

	const edits = [
		transformImport,
		transformDoneCallbacks,
		transformThisSkip,
		transformThisTimeout,
	].flatMap((transform) => transform(root));
	if (edits.length === 0) return null;

	return rootNode
		.commitEdits(edits)
		.split('\n')
		.map((line) => (line.trim() === '' ? line.trim() : line))
		.join('\n');
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
			any: [{ pattern: '$MOCHA_GLOBAL_FN($$$)' }],
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
		? `\nimport { ${imports} } from 'node:test';`
		: `\nconst { ${imports} } = require('node:test');`;

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
	const rootNode = root.root();
	const thisSkipCalls = rootNode.findAll({
		rule: { pattern: 'this.skip($$$)' },
	});

	return thisSkipCalls.flatMap((thisSkipCall) => {
		const edits: Edit[] = [];
		const memberExpr = thisSkipCall.find({
			rule: { kind: 'member_expression', has: { kind: 'this' } },
		});
		if (memberExpr !== null) {
			const thisKeyword = memberExpr.field('object');
			if (thisKeyword !== null) {
				edits.push(thisKeyword.replace('t'));
			}
		}

		const enclosingFunction = thisSkipCall
			.ancestors()
			.find((ancestor) =>
				['function_expression', 'arrow_function'].includes(ancestor.kind()),
			);
		if (enclosingFunction === undefined) {
			return edits;
		}

		const parameters =
			enclosingFunction.field('parameters') ??
			enclosingFunction.field('parameter');
		if (parameters === null) {
			return edits;
		}

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
	});
}

function transformThisTimeout(root: SgRoot<JS>): Edit[] {
	const rootNode = root.root();
	const thisTimeoutCalls = rootNode.findAll({
		rule: { pattern: 'this.timeout($TIME)' },
	});

	return thisTimeoutCalls.flatMap((thisTimeoutCall) => {
		const edits = [] as Edit[];
		const thisTimeoutExpression = thisTimeoutCall.parent();
		edits.push(thisTimeoutExpression.replace(''));

		const enclosingFunction = thisTimeoutCall
			.ancestors()
			.find((ancestor) =>
				['function_expression', 'arrow_function'].includes(ancestor.kind()),
			);
		if (enclosingFunction === undefined) {
			return edits;
		}

		const time = thisTimeoutCall.getMatch('TIME').text();
		edits.push({
			startPos: enclosingFunction.range().start.index,
			endPos: enclosingFunction.range().start.index,
			insertedText: `{ timeout: ${time} }, `,
		});
		return edits;
	});
}

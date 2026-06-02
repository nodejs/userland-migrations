import { getScope } from './get-scope.ts';
import {
	getNodeImportCalls,
	getNodeImportStatements,
} from './import-statement.ts';
import {
	getNodeRequireCalls,
	getRequireNamespaceIdentifier,
} from './require-call.ts';
import process from 'node:process';
import type { Edit, Range, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

const MODULE_NAME = 'ansi-colors';
const STYLE_MODULE = 'node:util';
const STYLE_FUNCTION = 'styleText';

const COMPATIBILITY_MAP: Record<string, string> = {
	overline: 'overlined',
};

const SUPPORTED_STYLES = new Set([
	'black',
	'red',
	'green',
	'yellow',
	'blue',
	'magenta',
	'cyan',
	'white',
	'gray',
	'grey',
	'blackBright',
	'redBright',
	'greenBright',
	'yellowBright',
	'blueBright',
	'magentaBright',
	'cyanBright',
	'whiteBright',
	'bgBlack',
	'bgRed',
	'bgGreen',
	'bgYellow',
	'bgBlue',
	'bgMagenta',
	'bgCyan',
	'bgWhite',
	'bgGray',
	'bgGrey',
	'bgBlackBright',
	'bgRedBright',
	'bgGreenBright',
	'bgYellowBright',
	'bgBlueBright',
	'bgMagentaBright',
	'bgCyanBright',
	'bgWhiteBright',
	'reset',
	'bold',
	'italic',
	'underline',
	'strikethrough',
	'hidden',
	'dim',
	'overlined',
	'blink',
	'inverse',
	'doubleunderline',
	'framed',
]);

const UNSUPPORTED_APIS = new Set([
	'enabled',
	'visible',
	'unstyle',
	'alias',
	'theme',
	'create',
]);

type StatementInfo = {
	statement: SgNode<Js>;
	binding: string;
};

export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const skippedRanges: Range[] = [];
	const statements = getAnsiColorsStatements(root);

	if (!statements.length) return null;

	for (const info of statements) {
		const unsupportedRanges = getUnsupportedScopes(rootNode, info.binding);
		skippedRanges.push(...unsupportedRanges);

		const importEdit = createStyleTextImportEdit(info.statement);
		if (importEdit && !isRangeWithinAny(importEdit.range, skippedRanges)) {
			edits.push(importEdit.edit);
		}
	}

	for (const info of statements) {
		const callEdits = getStyleCallEdits(rootNode, info.binding, skippedRanges);
		edits.push(...callEdits);
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

function getAnsiColorsStatements(root: SgRoot<Js>): StatementInfo[] {
	const statements: StatementInfo[] = [];

	for (const statement of getNodeImportStatements(root, MODULE_NAME)) {
		const binding = getDefaultOrNamespaceImport(statement);
		if (binding) {
			statements.push({ statement, binding: binding.text() });
		}
	}

	for (const statement of getNodeRequireCalls(root, MODULE_NAME)) {
		const binding = getRequireNamespaceIdentifier(statement);
		if (binding) {
			statements.push({ statement, binding: binding.text() });
		}
	}

	for (const statement of getNodeImportCalls(root, MODULE_NAME)) {
		const binding = getDynamicImportBinding(statement);
		if (binding) {
			statements.push({ statement, binding: binding.text() });
		}
	}

	return statements;
}

function getDefaultOrNamespaceImport(statement: SgNode<Js>): SgNode<Js> | null {
	const defaultImport = statement.find({
		rule: {
			kind: 'identifier',
			inside: {
				kind: 'import_clause',
				not: {
					any: [
						{ inside: { kind: 'named_imports' } },
						{ inside: { kind: 'namespace_import' } },
					],
				},
			},
		},
	});

	if (defaultImport) return defaultImport;

	return statement.find({
		rule: {
			kind: 'identifier',
			inside: {
				kind: 'namespace_import',
			},
		},
	});
}

function getDynamicImportBinding(statement: SgNode<Js>): SgNode<Js> | null {
	const binding = statement.find({
		rule: {
			kind: 'identifier',
			inside: {
				kind: 'variable_declarator',
				not: {
					inside: {
						kind: 'object_pattern',
					},
				},
			},
		},
	});

	return binding ?? null;
}

function createStyleTextImportEdit(statement: SgNode<Js>): { edit: Edit; range: Range } | null {
	if (statement.kind() === 'import_statement') {
		return {
			edit: statement.replace(`import { ${STYLE_FUNCTION} } from '${STYLE_MODULE}';`),
			range: statement.range(),
		};
	}

	const declaration = statement.parent();
	if (!declaration || declaration.kind() !== 'lexical_declaration') return null;

	const value = statement.field('value');
	if (value?.kind() !== 'await_expression') {
		return {
			edit: declaration.replace(`const { ${STYLE_FUNCTION} } = require('${STYLE_MODULE}');`),
			range: declaration.range(),
		};
	}

	return {
		edit: declaration.replace(`const { ${STYLE_FUNCTION} } = await import('${STYLE_MODULE}');`),
		range: declaration.range(),
	};
}

function getStyleCallEdits(
	rootNode: SgNode<Js>,
	binding: string,
	skippedRanges: Range[],
): Edit[] {
	const callEdits: Edit[] = [];
	const calls = rootNode.findAll({
		rule: {
			kind: 'call_expression',
			has: {
				field: 'function',
				kind: 'member_expression',
			},
		},
	});

	for (const call of calls) {
		if (isRangeWithinAny(call.range(), skippedRanges)) continue;

		const functionNode = call.field('function');
		if (!functionNode || functionNode.kind() !== 'member_expression') continue;

		const styles = extractStyles(functionNode, binding);
		if (!styles || !styles.length) continue;

		const textArg = getFirstCallArgument(call);
		if (!textArg) continue;

		callEdits.push(call.replace(createStyleTextReplacement(styles, textArg)));
	}

	return callEdits;
}

function extractStyles(node: SgNode<Js>, binding: string): string[] | null {
	const objectNode = node.field('object');
	const propertyNode = node.field('property');

	if (!objectNode || !propertyNode || propertyNode.kind() !== 'property_identifier') {
		return null;
	}

	const propertyName = normalizeStyleName(propertyNode.text());
	if (objectNode.kind() === 'identifier') {
		if (objectNode.text() !== binding) return null;
		if (!SUPPORTED_STYLES.has(propertyName)) return null;
		return [propertyName];
	}

	if (objectNode.kind() === 'member_expression') {
		const nested = extractStyles(objectNode, binding);
		if (!nested) return null;
		if (!SUPPORTED_STYLES.has(propertyName)) return null;
		return [...nested, propertyName];
	}

	return null;
}

function normalizeStyleName(styleName: string): string {
	return COMPATIBILITY_MAP[styleName] ?? styleName;
}

function getUnsupportedScopes(rootNode: SgNode<Js>, binding: string): Range[] {
	const unsupportedScopes = new Map<string, Range>();
	const memberExpressions = rootNode.findAll({
		rule: {
			kind: 'member_expression',
		},
	});

	for (const memberExpression of memberExpressions) {
		if (!isTopLevelChain(memberExpression, binding)) continue;

		const propertyNames = collectPropertyNames(memberExpression, binding);
		if (!propertyNames) continue;

		for (const propertyName of propertyNames) {
			if (!UNSUPPORTED_APIS.has(propertyName)) continue;
			warnUnsupportedApi(memberExpression.getRoot(), memberExpression, propertyName);
			const scope = getScope(memberExpression);
			if (scope) {
				unsupportedScopes.set(
					`${scope.range().start.index}:${scope.range().end.index}`,
					scope.range(),
				);
			}
			break;
		}
	}

	return [...unsupportedScopes.values()];
}

function isTopLevelChain(node: SgNode<Js>, binding: string): boolean {
	if (!isRootedAtBinding(node, binding)) return false;

	const parent = node.parent();
	if (!parent || parent.kind() !== 'member_expression') return true;

	return !isRootedAtBinding(parent, binding);
}

function collectPropertyNames(node: SgNode<Js>, binding: string): string[] | null {
	const objectNode = node.field('object');
	const propertyNode = node.field('property');

	if (!objectNode || !propertyNode || propertyNode.kind() !== 'property_identifier') {
		return null;
	}

	if (objectNode.kind() === 'identifier') {
		if (objectNode.text() !== binding) return null;
		return [propertyNode.text()];
	}

	if (objectNode.kind() === 'member_expression') {
		const nested = collectPropertyNames(objectNode, binding);
		if (!nested) return null;
		return [...nested, propertyNode.text()];
	}

	return null;
}

function isRootedAtBinding(node: SgNode<Js>, binding: string): boolean {
	const objectNode = node.field('object');
	const propertyNode = node.field('property');

	if (!objectNode || !propertyNode || propertyNode.kind() !== 'property_identifier') {
		return false;
	}

	if (objectNode.kind() === 'identifier') {
		return objectNode.text() === binding;
	}

	if (objectNode.kind() === 'member_expression') {
		return isRootedAtBinding(objectNode, binding);
	}

	return false;
}

function warnUnsupportedApi(
	rootNode: SgRoot<Js>,
	node: SgNode<Js>,
	api: string,
) {
	const filename = rootNode.filename();
	const { start } = node.range();
	const message = `${filename}:${start.line}:${start.column}: uses ansi-colors API '${api}' that does not have any equivalent in util.styleText please review this line`;

	process.stderr.write(`${message}\n`);
}

function getFirstCallArgument(call: SgNode<Js>): string | null {
	const args = call.field('arguments');
	if (!args) return null;

	const children = args.children().filter((child) => ![',', '(', ')'].includes(child.kind()));
	if (!children.length) return null;

	return children[0].text();
}

function createStyleTextReplacement(styles: string[], textArg: string): string {
	if (styles.length === 1) {
		return `${STYLE_FUNCTION}('${styles[0]}', ${textArg})`;
	}

	return `${STYLE_FUNCTION}([${styles.map((style) => `'${style}'`).join(', ')}], ${textArg})`;
}

function isRangeWithinAny(inner: Range, outers: Range[]): boolean {
	return outers.some(
		(outer) =>
			inner.start.index >= outer.start.index && inner.end.index <= outer.end.index,
	);
}
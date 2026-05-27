import type { Edit, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';

const colorsModule = 'colors';
const safeColorsModule = 'colors/safe';

const COMPAT_MAP: Record<string, string> = {
	bgGrey: 'bgGray',
	grey: 'gray',
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
	'dim',
	'italic',
	'underline',
	'inverse',
	'hidden',
	'strikethrough',
]);

const UNSUPPORTED_EXTRAS = new Set([
	'america',
	'rainbow',
	'random',
	'trap',
	'zebra',
]);

export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	const colorsStatements = getModuleDependencies(root, colorsModule);
	const safeColorsStatements = getModuleDependencies(root, safeColorsModule);

	if (!colorsStatements.length && !safeColorsStatements.length) return null;

	for (const statement of safeColorsStatements) {
		processStatement(rootNode, statement, edits, true);
	}

	for (const statement of colorsStatements) {
		processStatement(rootNode, statement, edits, false);
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

function processStatement(
	rootNode: SgNode<Js>,
	statement: SgNode<Js>,
	edits: Edit[],
	isSafeImport: boolean,
): void {
	const initialEditCount = edits.length;
	const destructuredNames = getDestructuredNames(statement);
	const blockedPrototypeBases = new Set<string>();

	if (destructuredNames.length > 0) {
		processDestructuredSafeCalls(rootNode, destructuredNames, edits);
	} else {
		const binding = resolveOptionalBinding(statement);

		if (binding) {
			blockedPrototypeBases.add(binding);
			processSafeNamespaceCalls(rootNode, binding, edits);
		}
	}

	if (!isSafeImport) {
		processPrototypeStyles(rootNode, edits, blockedPrototypeBases);
	}

	if (edits.length > initialEditCount) {
		const importReplacement = createImportReplacement(statement);

		if (importReplacement) {
			edits.push(statement.replace(importReplacement));
		}
	}
}

function resolveOptionalBinding(statement: SgNode<Js>): string | undefined {
	if (
		statement.kind() === 'import_statement' &&
		!statement.find({ rule: { kind: 'import_clause' } })
	) {
		return undefined;
	}

	return resolveBindingPath(statement, '$');
}

function getDestructuredNames(
	statement: SgNode<Js>,
): Array<{ imported: string; local: string }> {
	const names: Array<{ imported: string; local: string }> = [];

	if (statement.kind() === 'import_statement') {
		const namedImports = statement.find({
			rule: { kind: 'named_imports' },
		});

		if (!namedImports) return names;

		const importSpecifiers = namedImports.findAll({
			rule: { kind: 'import_specifier' },
		});

		for (const specifier of importSpecifiers) {
			const importedName = specifier.field('name');
			const alias = specifier.field('alias');

			if (importedName) {
				const imported = importedName.text();
				names.push({ imported, local: alias ? alias.text() : imported });
			}
		}
	} else if (statement.kind() === 'variable_declarator') {
		const nameField = statement.field('name');

		if (nameField?.kind() !== 'object_pattern') return names;

		const properties = nameField.findAll({
			rule: {
				any: [
					{ kind: 'shorthand_property_identifier_pattern' },
					{ kind: 'pair_pattern' },
				],
			},
		});

		for (const prop of properties) {
			if (prop.kind() === 'shorthand_property_identifier_pattern') {
				const name = prop.text();

				names.push({ imported: name, local: name });
			} else if (prop.kind() === 'pair_pattern') {
				const key = prop.field('key');
				const value = prop.field('value');

				if (key && value) {
					names.push({ imported: key.text(), local: value.text() });
				}
			}
		}
	}

	return names;
}

function processDestructuredSafeCalls(
	rootNode: SgNode<Js>,
	destructuredNames: Array<{ imported: string; local: string }>,
	edits: Edit[],
): void {
	for (const { imported, local } of destructuredNames) {
		const calls = rootNode.findAll({
			rule: {
				kind: 'call_expression',
				has: {
					field: 'function',
					any: [
						{ kind: 'identifier', pattern: local },
						{
							kind: 'member_expression',
							has: {
								field: 'object',
								any: [
									{ kind: 'identifier', pattern: local },
									{
										kind: 'member_expression',
										has: {
											field: 'object',
											kind: 'identifier',
											pattern: local,
										},
									},
								],
							},
						},
					],
				},
			},
		});

		for (const call of calls) {
			const functionExpr = call.field('function');
			if (!functionExpr) continue;

			const styles =
				functionExpr.kind() === 'identifier'
					? [normalizeStyle(imported)]
					: extractNamespaceStyles(functionExpr, local, normalizeStyle(imported));

			replaceSafeCall(rootNode, call, styles, edits);
		}
	}
}

function processSafeNamespaceCalls(
	rootNode: SgNode<Js>,
	binding: string,
	edits: Edit[],
): void {
	const calls = rootNode.findAll({
		rule: { kind: 'call_expression' },
	});

	for (const call of calls) {
		const functionExpr = call.field('function');

		if (functionExpr?.kind() !== 'member_expression') continue;

		const styles = extractNamespaceStyles(functionExpr, binding);
		replaceSafeCall(rootNode, call, styles, edits);
	}
}

function replaceSafeCall(
	rootNode: SgNode<Js>,
	call: SgNode<Js>,
	styles: string[],
	edits: Edit[],
): void {
	if (styles.length === 0) return;

	if (hasUnsupportedStyles(styles)) {
		warnOnUnsupportedStyle(styles, rootNode, call);
		return;
	}

	const textArg = getFirstCallArgument(call);

	if (!textArg) return;

	edits.push(call.replace(createStyleTextReplacement(styles, textArg)));
}

function processPrototypeStyles(
	rootNode: SgNode<Js>,
	edits: Edit[],
	blockedPrototypeBases: Set<string>,
): void {
	const memberExpressions = rootNode.findAll({
		rule: { kind: 'member_expression' },
	});

	for (const memberExpression of memberExpressions) {
		if (isNestedStyleChain(memberExpression)) continue;
		if (isCallFunction(memberExpression)) continue;

		const prototypeStyle = extractPrototypeStyles(memberExpression);

		if (!prototypeStyle) continue;
		if (blockedPrototypeBases.has(prototypeStyle.text)) continue;

		if (hasUnsupportedStyles(prototypeStyle.styles)) {
			warnOnUnsupportedStyle(prototypeStyle.styles, rootNode, memberExpression);
			continue;
		}

		edits.push(
			memberExpression.replace(
				createStyleTextReplacement(prototypeStyle.styles, prototypeStyle.text),
			),
		);
	}
}

function extractNamespaceStyles(
	node: SgNode<Js>,
	binding: string,
	initialStyle?: string,
): string[] {
	const styles = initialStyle ? [initialStyle] : [];

	function traverse(current: SgNode<Js>): boolean {
		const object = current.field('object');
		const property = current.field('property');

		if (!object || property?.kind() !== 'property_identifier') return false;

		const propertyName = normalizeStyle(property.text());

		if (object.kind() === 'identifier' && object.text() === binding) {
			styles.push(propertyName);
			return true;
		}

		if (object.kind() === 'member_expression' && traverse(object)) {
			styles.push(propertyName);
			return true;
		}

		return false;
	}

	traverse(node);

	return styles;
}

function extractPrototypeStyles(
	node: SgNode<Js>,
): { text: string; styles: string[] } | null {
	const property = node.field('property');
	const object = node.field('object');

	if (!object || property?.kind() !== 'property_identifier') return null;

	const style = normalizeStyle(property.text());

	if (!isSupportedOrKnownUnsupported(style)) return null;

	if (object.kind() === 'member_expression') {
		const nested = extractPrototypeStyles(object);

		if (!nested) return null;

		return { text: nested.text, styles: [...nested.styles, style] };
	}

	if (!isSupportedPrototypeBase(object)) return null;

	return { text: object.text(), styles: [style] };
}

function isSupportedPrototypeBase(node: SgNode<Js>): boolean {
	return [
		'identifier',
		'parenthesized_expression',
		'string',
		'template_string',
	].includes(node.kind());
}

function normalizeStyle(style: string): string {
	return COMPAT_MAP[style] || style;
}

function isSupportedOrKnownUnsupported(style: string): boolean {
	return SUPPORTED_STYLES.has(style) || UNSUPPORTED_EXTRAS.has(style);
}

function hasUnsupportedStyles(styles: string[]): boolean {
	return styles.some((style) => !SUPPORTED_STYLES.has(style));
}

function getFirstCallArgument(call: SgNode<Js>): string | null {
	const args = call.field('arguments');

	if (!args) return null;

	const argsList = args.children().filter((child) => {
		const excluded = [',', '(', ')'];
		return !excluded.includes(child.kind());
	});

	if (argsList.length === 0) return null;

	return argsList[0].text();
}

function createStyleTextReplacement(styles: string[], textArg: string): string {
	if (styles.length === 1) {
		return `styleText("${styles[0]}", ${textArg})`;
	}

	return `styleText([${styles.map((style) => `"${style}"`).join(', ')}], ${textArg})`;
}

function createImportReplacement(statement: SgNode<Js>): string {
	if (statement.kind() === 'import_statement') {
		return 'import { styleText } from "node:util";';
	}

	if (statement.kind() === 'variable_declarator') {
		if (statement.field('value')?.kind() === 'await_expression') {
			return '{ styleText } = await import("node:util")';
		}

		return '{ styleText } = require("node:util")';
	}

	return '';
}

function isNestedStyleChain(node: SgNode<Js>): boolean {
	const parent = node.parent();

	if (parent?.kind() !== 'member_expression') return false;

	const object = parent.field('object');
	const property = parent.field('property');

	return (
		object?.text() === node.text() &&
		property?.kind() === 'property_identifier' &&
		isSupportedOrKnownUnsupported(normalizeStyle(property.text()))
	);
}

function isCallFunction(node: SgNode<Js>): boolean {
	const parent = node.parent();

	if (parent?.kind() !== 'call_expression') return false;

	return parent.field('function')?.text() === node.text();
}

function warnOnUnsupportedStyle(
	styles: string[],
	rootNode: SgNode<Js>,
	node: SgNode<Js>,
): void {
	const filename = rootNode.getRoot().filename();
	const { start } = node.range();
	const unsupported = styles.filter((style) => !SUPPORTED_STYLES.has(style));

	for (const style of unsupported) {
		console.warn(
			`${filename}:${start.line}:${start.column}: uses colors style '${style}' that does not have any equivalent in util.styleText; please review this line`,
		);
	}
}

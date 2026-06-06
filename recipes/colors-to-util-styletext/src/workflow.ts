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

/** Converts supported colors imports and usages to util.styleText. */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	const colorsStatements = getModuleDependencies(root, colorsModule);
	const safeColorsStatements = getModuleDependencies(root, safeColorsModule);
	const safeThenCalls = getSafeDynamicImportThenCalls(rootNode);

	if (
		!colorsStatements.length &&
		!safeColorsStatements.length &&
		!safeThenCalls.length
	) {
		return null;
	}

	for (const statement of safeColorsStatements) {
		processStatement(rootNode, statement, edits, true);
	}

	for (const thenCall of safeThenCalls) {
		processDynamicImportThenCall(thenCall, edits);
	}

	for (const statement of colorsStatements) {
		processStatement(rootNode, statement, edits, false);
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

/** Rewrites one colors dependency statement and its related usages. */
function processStatement(
	rootNode: SgNode<Js>,
	statement: SgNode<Js>,
	edits: Edit[],
	isSafeImport: boolean,
): void {
	const editCountBeforeStatement = edits.length;
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

	if (edits.length > editCountBeforeStatement) {
		const importReplacement = createImportReplacement(statement);

		if (importReplacement) {
			edits.push(statement.replace(importReplacement));
		}
	} else if (
		isSafeImport &&
		['import_statement', 'variable_declarator'].includes(statement.kind())
	) {
		edits.push(removeUnusedSafeImport(statement));
	}
}

/** Returns the local binding for namespace imports/requires when one exists. */
function resolveOptionalBinding(statement: SgNode<Js>): string | undefined {
	if (
		statement.is('import_statement') &&
		!statement.find({ rule: { kind: 'import_clause' } })
	) {
		return undefined;
	}

	return resolveBindingPath(statement, '$');
}

/** Collects imported colors names from destructured imports and requires. */
function getDestructuredNames(
	statement: SgNode<Js>,
): Array<{ imported: string; local: string }> {
	const names: Array<{ imported: string; local: string }> = [];
	const statementKind = statement.kind();

	switch (statementKind) {
		case 'import_statement': {
			const namedImports = statement.find({
				rule: { kind: 'named_imports' },
			});

			if (!namedImports) break;

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
			break;
		}
		case 'variable_declarator': {
			const nameField = statement.field('name');

			if (nameField?.kind() !== 'object_pattern') break;

			const properties = nameField.findAll({
				rule: {
					any: [
						{ kind: 'shorthand_property_identifier_pattern' },
						{ kind: 'pair_pattern' },
					],
				},
			});

			for (const prop of properties) {
				const propKind = prop.kind();

				switch (propKind) {
					case 'shorthand_property_identifier_pattern': {
						const name = prop.text();

						names.push({ imported: name, local: name });
						break;
					}
					case 'pair_pattern': {
						const key = prop.field('key');
						const value = prop.field('value');

						if (key && value) {
							names.push({ imported: key.text(), local: value.text() });
						}
						break;
					}
				}
			}
			break;
		}
	}

	return names;
}

/** Rewrites calls that use destructured colors/safe helpers. */
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
					: extractNamespaceStyles(
							functionExpr,
							local,
							normalizeStyle(imported),
						);

			replaceSafeCall(rootNode, call, styles, edits);
		}
	}
}

/** Rewrites colors/safe usages inside dynamic import .then callbacks. */
function processDynamicImportThenCall(
	thenCall: SgNode<Js>,
	edits: Edit[],
): void {
	const callback = getCallArguments(thenCall)[0];

	if (!callback) return;

	const destructuredParam = callback.find({
		rule: { kind: 'object_pattern' },
	});

	if (!destructuredParam) return;

	const destructuredNames = getNamesFromObjectPattern(destructuredParam);
	const editCountBeforeCall = edits.length;

	processDestructuredSafeCalls(callback, destructuredNames, edits);

	if (edits.length > editCountBeforeCall) {
		const dynamicImport = thenCall.field('function')?.field('object');

		if (dynamicImport) {
			edits.push(dynamicImport.replace('import("node:util")'));
		}
		edits.push(destructuredParam.replace('{ styleText }'));
	}
}

/** Rewrites calls accessed through a colors/safe namespace binding. */
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

/** Replaces a safe colors call with util.styleText when it can be mapped. */
function replaceSafeCall(
	rootNode: SgNode<Js>,
	call: SgNode<Js>,
	styles: string[],
	edits: Edit[],
): void {
	if (!styles.length) return;

	if (hasUnsupportedStyles(styles)) {
		warnOnUnsupportedStyle(styles, rootNode, call);
		return;
	}

	const textArg = getFirstCallArgument(call);

	if (!textArg) return;

	edits.push(call.replace(createStyleTextReplacement(styles, textArg)));
}

/** Rewrites colors prototype style chains such as "text".green. */
function processPrototypeStyles(
	rootNode: SgNode<Js>,
	edits: Edit[],
	blockedPrototypeBases: Set<string>,
): void {
	const memberExpressions = rootNode.findAll({
		rule: { kind: 'member_expression' },
	});

	for (const memberExpression of memberExpressions) {
		if (
			isNestedStyleChain(memberExpression) ||
			isCallFunction(memberExpression)
		) {
			continue;
		}

		const prototypeStyle = extractPrototypeStyles(memberExpression);

		if (!prototypeStyle || blockedPrototypeBases.has(prototypeStyle.text)) {
			continue;
		}

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

/** Reads the style chain from a safe namespace call. */
function extractNamespaceStyles(
	node: SgNode<Js>,
	binding: string,
	initialStyle?: string,
): string[] {
	const styles = initialStyle ? [initialStyle] : [];

	/** Walks a member chain until it reaches the expected namespace binding. */
	function traverse(current: SgNode<Js>): boolean {
		const object = current.field('object');
		const property = current.field('property');

		if (!object || property?.kind() !== 'property_identifier') return false;

		const propertyName = normalizeStyle(property.text());
		const objectKind = object.kind();

		if (objectKind === 'identifier' && object.text() === binding) {
			styles.push(propertyName);
			return true;
		}

		if (objectKind === 'member_expression' && traverse(object)) {
			styles.push(propertyName);
			return true;
		}

		return false;
	}

	traverse(node);

	return styles;
}

/** Reads the style chain from a prototype access expression. */
function extractPrototypeStyles(
	node: SgNode<Js>,
): { text: string; styles: string[] } | null {
	const property = node.field('property');
	const object = node.field('object');

	if (!object || property?.kind() !== 'property_identifier') return null;

	const style = normalizeStyle(property.text());

	if (!isSupportedOrKnownUnsupported(style)) return null;

	if (object.is('member_expression')) {
		const nested = extractPrototypeStyles(object);

		if (!nested) return null;

		return { text: nested.text, styles: [...nested.styles, style] };
	}

	if (!isSupportedPrototypeBase(object)) return null;

	return { text: object.text(), styles: [style] };
}

/** Checks whether a node can safely be used as the text argument. */
function isSupportedPrototypeBase(node: SgNode<Js>): boolean {
	return [
		'identifier',
		'parenthesized_expression',
		'string',
		'template_string',
	].includes(node.kind());
}

/** Normalizes colors aliases to util.styleText names. */
function normalizeStyle(style: string): string {
	return COMPAT_MAP[style] || style;
}

/** Keeps traversal limited to colors styles that are known to the recipe. */
function isSupportedOrKnownUnsupported(style: string): boolean {
	return SUPPORTED_STYLES.has(style) || UNSUPPORTED_EXTRAS.has(style);
}

/** Detects styles that colors supports but util.styleText does not. */
function hasUnsupportedStyles(styles: string[]): boolean {
	return styles.some((style) => !SUPPORTED_STYLES.has(style));
}

/** Returns the first real argument for a colors/safe call. */
function getFirstCallArgument(call: SgNode<Js>): string | null {
	return getCallArguments(call)[0]?.text() ?? null;
}

/** Returns named call arguments. */
function getCallArguments(call: SgNode<Js>): Array<SgNode<Js>> {
	const args = call.field('arguments');

	if (!args) return [];

	return args.children().filter((child) => child.isNamed());
}

/** Builds a util.styleText call for one or more styles. */
function createStyleTextReplacement(styles: string[], textArg: string): string {
	if (styles.length === 1) {
		return `styleText("${styles[0]}", ${textArg})`;
	}

	return `styleText([${styles.map((style) => `"${style}"`).join(', ')}], ${textArg})`;
}

/** Builds the matching util.styleText import or require replacement. */
function createImportReplacement(statement: SgNode<Js>): string {
	const statementKind = statement.kind();

	switch (statementKind) {
		case 'import_statement':
			return 'import { styleText } from "node:util";';
		case 'variable_declarator': {
			if (statement.field('value')?.kind() === 'await_expression') {
				return '{ styleText } = await import("node:util")';
			}

			return '{ styleText } = require("node:util")';
		}
	}

	return '';
}

/** Finds `import("colors/safe").then(...)` calls. */
function getSafeDynamicImportThenCalls(rootNode: SgNode<Js>): Array<SgNode<Js>> {
	return rootNode
		.findAll({
			rule: { kind: 'call_expression' },
		})
		.filter((call) => {
			const functionExpr = call.field('function');

			if (functionExpr?.kind() !== 'member_expression') return false;

			const object = functionExpr.field('object');
			const property = functionExpr.field('property');

			return property?.text() === 'then' && isSafeDynamicImport(object);
		});
}

/** Checks for `import("colors/safe")`. */
function isSafeDynamicImport(node: SgNode<Js> | null): boolean {
	if (node?.kind() !== 'call_expression') return false;

	const functionExpr = node.field('function');
	const moduleName = getFirstCallArgument(node);

	return (
		functionExpr?.text() === 'import' &&
		(moduleName === '"colors/safe"' || moduleName === "'colors/safe'")
	);
}

/** Removes an unused colors/safe dependency statement. */
function removeUnusedSafeImport(statement: SgNode<Js>): Edit {
	const parent = statement.parent();

	if (
		parent &&
		['lexical_declaration', 'variable_declaration'].includes(parent.kind())
	) {
		return parent.replace('');
	}

	return statement.replace('');
}

/** Returns destructured names from an object pattern node. */
function getNamesFromObjectPattern(
	objectPattern: SgNode<Js>,
): Array<{ imported: string; local: string }> {
	const names: Array<{ imported: string; local: string }> = [];
	const properties = objectPattern.findAll({
		rule: {
			any: [
				{ kind: 'shorthand_property_identifier_pattern' },
				{ kind: 'pair_pattern' },
			],
		},
	});

	for (const prop of properties) {
		const propKind = prop.kind();

		switch (propKind) {
			case 'shorthand_property_identifier_pattern': {
				const name = prop.text();

				names.push({ imported: name, local: name });
				break;
			}
			case 'pair_pattern': {
				const key = prop.field('key');
				const value = prop.field('value');

				if (key && value) {
					names.push({ imported: key.text(), local: value.text() });
				}
				break;
			}
		}
	}

	return names;
}

/** Skips intermediate members so only the full style chain is replaced. */
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

/** Skips member expressions that are already part of a call expression. */
function isCallFunction(node: SgNode<Js>): boolean {
	const parent = node.parent();

	if (parent?.kind() !== 'call_expression') return false;

	return parent.field('function')?.text() === node.text();
}

/** Emits a review warning for colors styles that cannot be mapped. */
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

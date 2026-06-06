import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import type { Edit, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';

const kleurBinding = 'kleur';
const kleurColorsBinding = 'kleur/colors';

type StyleCall = {
	styles: string[];
	textArg: string;
};

/**
 * Converts kleur and kleur/colors style calls to Node.js util.styleText calls.
 *
 * Handles default, namespace, CommonJS, awaited dynamic imports, and
 * kleur/colors named style imports.
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const statements = [
		...getModuleDependencies(root, kleurBinding).map((statement) => ({
			moduleName: kleurBinding,
			statement,
		})),
		...getModuleDependencies(root, kleurColorsBinding).map((statement) => ({
			moduleName: kleurColorsBinding,
			statement,
		})),
	];

	if (!statements.length) return null;

	for (const { moduleName, statement } of statements) {
		const initialEditCount = edits.length;

		if (moduleName === kleurColorsBinding) {
			const destructuredNames = getDestructuredNames(statement);
			processKleurColorsImports(rootNode, destructuredNames, edits);
		} else {
			const binding = resolveBindingPath(statement, '$');

			if (binding && !hasUnsupportedEnabledUsage(rootNode, binding)) {
				processKleurImports(rootNode, binding, edits);
			}
		}

		if (edits.length > initialEditCount) {
			if (statement.is('expression_statement')) {
				edits.push(...createDynamicImportReplacementEdits(statement));
				continue;
			}

			const importReplacement = createImportReplacement(statement);
			if (importReplacement) {
				edits.push(statement.replace(importReplacement));
			}
		}
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

const COMPAT_MAP: Record<string, string> = {
	overline: 'overlined',
};

/**
 * Kleur style methods that can be mapped to util.styleText.
 */
const SUPPORTED_METHODS = new Set([
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

/**
 * Maps kleur method names that have a different util.styleText spelling.
 */
function mapStyle(style: string): string {
	return COMPAT_MAP[style] || style;
}

/**
 * Returns whether a kleur method maps to a util.styleText style.
 */
function isSupportedMethod(method: string): boolean {
	return SUPPORTED_METHODS.has(mapStyle(method));
}

/**
 * Returns the style methods that should be left for manual migration.
 */
function getUnsupportedMethods(styles: string[]): string[] {
	return styles.filter((style) => !isSupportedMethod(style));
}

/**
 * Extracts named imports from import statements and destructured requires.
 */
function getDestructuredNames(
	statement: SgNode<Js>,
): Array<{ imported: string; local: string }> {
	const names: Array<{ imported: string; local: string }> = [];
	const statementKind = statement.kind();

	if (statementKind === 'import_statement') {
		const namedImports = statement.find({
			rule: { kind: 'named_imports' },
		});

		if (namedImports) {
			const importSpecifiers = namedImports.findAll({
				rule: { kind: 'import_specifier' },
			});

			for (const specifier of importSpecifiers) {
				const importedName = specifier.field('name');
				const alias = specifier.field('alias');

				if (importedName) {
					const imported = importedName.text();
					const local = alias ? alias.text() : imported;

					names.push({ imported, local });
				}
			}
		}
	} else if (statementKind === 'variable_declarator') {
		const nameField = statement.field('name');

		if (nameField && nameField.kind() === 'object_pattern') {
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
	}

	return names;
}

/**
 * Transforms calls that use the default or namespace kleur binding.
 */
function processKleurImports(
	rootNode: SgNode<Js>,
	binding: string,
	edits: Edit[],
): void {
	const calls = rootNode.findAll({
		rule: { kind: 'call_expression' },
	});

	for (const call of calls) {
		const functionExpr = call.field('function');
		if (!functionExpr) continue;

		const styles = extractKleurStyles(functionExpr, binding);
		if (!styles || styles.length === 0) continue;

		const unsupportedMethods = getUnsupportedMethods(styles);

		if (unsupportedMethods.length) {
			for (const method of unsupportedMethods) {
				warnOnUnsupportedMethod(method, rootNode, call);
			}
			continue;
		}

		const textArg = getFirstCallArgument(call);
		if (!textArg) continue;

		edits.push(call.replace(createStyleTextReplacement(styles, textArg)));
	}
}

/**
 * Transforms calls imported from kleur/colors named exports.
 */
function processKleurColorsImports(
	rootNode: SgNode<Js>,
	destructuredNames: Array<{ imported: string; local: string }>,
	edits: Edit[],
): void {
	if (!destructuredNames.length) return;

	const unsupportedNames = destructuredNames.filter(
		(name) => !isSupportedMethod(name.imported),
	);

	if (unsupportedNames.length) {
		for (const name of unsupportedNames) {
			warnOnUnsupportedMethod(name.imported, rootNode, rootNode);
		}
		return;
	}

	const styleImports = new Map<string, string>();

	for (const name of destructuredNames) {
		styleImports.set(name.local, mapStyle(name.imported));
	}

	const calls = rootNode.findAll({
		rule: { kind: 'call_expression' },
	});

	for (const call of calls) {
		if (hasKleurColorsCallAncestor(call, styleImports)) continue;

		const parsed = extractKleurColorsCall(call, styleImports);
		if (!parsed) continue;

		edits.push(
			call.replace(createStyleTextReplacement(parsed.styles, parsed.textArg)),
		);
	}
}

/**
 * Extracts a kleur style chain from a member expression.
 */
function extractKleurStyles(
	node: SgNode<Js>,
	binding: string,
): string[] | null {
	const styles: string[] = [];

	function traverse(activeNode: SgNode<Js>): boolean {
		if (activeNode.kind() !== 'member_expression') return false;

		const obj = activeNode.field('object');
		const prop = activeNode.field('property');

		if (!obj || !prop?.is('property_identifier')) {
			return false;
		}

		const objKind = obj.kind();
		const propName = mapStyle(prop.text());

		if (objKind === 'identifier' && obj.text() === binding) {
			styles.push(propName);
			return true;
		}

		if (objKind === 'member_expression' && traverse(obj)) {
			styles.push(propName);
			return true;
		}

		if (objKind === 'call_expression') {
			const chainedArgs = getCallArguments(obj);
			const chainedFunction = obj.field('function');

			if (
				chainedArgs.length === 0 &&
				chainedFunction &&
				traverse(chainedFunction)
			) {
				styles.push(propName);
				return true;
			}
		}

		return false;
	}

	return traverse(node) ? styles : null;
}

/**
 * Extracts a kleur/colors call and nested style calls.
 */
function extractKleurColorsCall(
	call: SgNode<Js>,
	styleImports: Map<string, string>,
): StyleCall | null {
	const functionExpr = call.field('function');

	if (!functionExpr || functionExpr.kind() !== 'identifier') {
		return null;
	}

	const style = styleImports.get(functionExpr.text());
	if (!style) return null;

	const firstArg = getFirstCallArgumentNode(call);
	if (!firstArg) return null;

	if (firstArg.kind() === 'call_expression') {
		const nested = extractKleurColorsCall(firstArg, styleImports);

		if (nested) {
			return {
				styles: [style, ...nested.styles],
				textArg: nested.textArg,
			};
		}
	}

	return {
		styles: [style],
		textArg: firstArg.text(),
	};
}

/**
 * Skips nested kleur/colors calls so only the outer call is replaced.
 */
function hasKleurColorsCallAncestor(
	call: SgNode<Js>,
	styleImports: Map<string, string>,
): boolean {
	let parentNode = call.parent();

	while (parentNode) {
		if (
			parentNode.is('call_expression') &&
			extractKleurColorsCall(parentNode, styleImports)
		) {
			return true;
		}

		parentNode = parentNode.parent();
	}

	return false;
}

/**
 * Detects kleur.enabled assignments that need manual migration.
 */
function hasUnsupportedEnabledUsage(
	rootNode: SgNode<Js>,
	binding: string,
): boolean {
	const enabledUsage = rootNode.find({
		rule: {
			kind: 'member_expression',
			all: [
				{
					has: {
						field: 'object',
						kind: 'identifier',
						pattern: binding,
					},
				},
				{
					has: {
						field: 'property',
						kind: 'property_identifier',
						pattern: 'enabled',
					},
				},
			],
		},
	});

	if (enabledUsage) {
		warnOnUnsupportedMethod('enabled', rootNode, enabledUsage);
		return true;
	}

	return false;
}

/**
 * Returns the first argument text from a call expression.
 */
function getFirstCallArgument(call: SgNode<Js>): string | null {
	return getFirstCallArgumentNode(call)?.text() || null;
}

/**
 * Returns the first argument node from a call expression.
 */
function getFirstCallArgumentNode(call: SgNode<Js>): SgNode<Js> | null {
	const args = getCallArguments(call);

	if (args.length === 0) return null;

	return args[0] || null;
}

/**
 * Returns the non-punctuation argument nodes from a call expression.
 */
function getCallArguments(call: SgNode<Js>): SgNode<Js>[] {
	const args = call.field('arguments');

	if (!args) return [];

	return args.children().filter((child) => {
		const excluded = [',', '(', ')'];
		return !excluded.includes(child.kind());
	});
}

/**
 * Builds a util.styleText call for one or more styles.
 */
function createStyleTextReplacement(styles: string[], textArg: string): string {
	if (styles.length === 1) {
		return `styleText("${styles[0]}", ${textArg})`;
	}

	const stylesArray = `[${styles.map((style) => `"${style}"`).join(', ')}]`;

	return `styleText(${stylesArray}, ${textArg})`;
}

/**
 * Replaces kleur imports with node:util styleText imports.
 */
function createImportReplacement(statement: SgNode<Js>): string | null {
	const statementKind = statement.kind();

	if (statementKind === 'import_statement') {
		return `import { styleText } from "node:util";`;
	}

	if (statementKind === 'variable_declarator') {
		if (statement.field('value')?.kind() === 'await_expression') {
			return `{ styleText } = await import("node:util")`;
		}

		return `{ styleText } = require("node:util")`;
	}

	return null;
}

/**
 * Builds edits for import("kleur").then((kleur) => ...) callback imports.
 */
function createDynamicImportReplacementEdits(statement: SgNode<Js>): Edit[] {
	const importCall = statement.find({
		rule: {
			kind: 'call_expression',
			has: {
				field: 'function',
				kind: 'import',
			},
		},
	});

	const callback =
		statement.find({
			rule: { kind: 'arrow_function' },
		}) ||
		statement.find({
			rule: { kind: 'function_expression' },
		});

	const edits: Edit[] = [];

	if (importCall) {
		edits.push(importCall.replace('import("node:util")'));
	}

	if (!callback) return edits;

	const args = callback.field('parameter') || callback.field('parameters');

	if (args) {
		if (args.is('formal_parameters')) {
			const firstArg = args.child(1);

			if (firstArg) {
				edits.push(firstArg.replace('{ styleText }'));
			}

			return edits;
		}

		edits.push(args.replace('({ styleText })'));

		return edits;
	}

	const firstFormalArg = callback.find({
		rule: {
			kind: 'identifier',
			inside: {
				kind: 'formal_parameters',
				stopBy: 'end',
			},
		},
	});

	if (firstFormalArg) {
		edits.push(firstFormalArg.replace('{ styleText }'));
	}

	return edits;
}

/**
 * Emits a location-aware warning for unsupported kleur methods.
 */
function warnOnUnsupportedMethod(
	method: string,
	rootNode: SgNode<Js>,
	node: SgNode<Js>,
) {
	const filename = rootNode.getRoot().filename();
	const { start } = node.range();

	console.warn(
		`${filename}:${start.line}:${start.column}: uses kleur method '${method}' that does not have any equivalent in util.styleText please review this line`,
	);
}

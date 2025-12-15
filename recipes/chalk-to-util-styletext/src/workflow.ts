import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import {
	getNodeImportCalls,
	getNodeImportStatements,
} from '@nodejs/codemod-utils/ast-grep/import-statement';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import type { Edit, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

/**
 * Transform function that converts chalk method calls to Node.js util.styleText calls.
 *
 * Examples:
 * - chalk.red("text") → styleText("red", "text")
 * - chalk.red.bold("text") → styleText(["red", "bold"], "text")
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const chalkBinding = 'chalk';

	// This actually catches `node:chalk` import but we don't care as it shouldn't append
	const statements = [
		...getNodeImportStatements(root, chalkBinding),
		...getNodeRequireCalls(root, chalkBinding),
		...getNodeImportCalls(root, chalkBinding),
	];

	// If there aren't any imports then we don't process the file
	if (!statements.length) return null;

	for (const statement of statements) {
		const initialEditCount = edits.length;

		// Check if we're dealing with a destructured import/require first
		const destructuredNames = getDestructuredNames(statement);

		if (destructuredNames.length > 0) {
			// Handle destructured imports
			// const { red } = require('chalk') or import { red } from 'chalk'
			processDestructuredImports(rootNode, destructuredNames, edits);

			// TODO - Handle special instances like chalkStderr
		} else {
			// Handle default imports
			// const chalk = require('chalk') or import chalk from 'chalk'
			const binding = resolveBindingPath(statement, '$');

			if (binding) {
				processDefaultImports(rootNode, binding, edits);
			}
		}

		// Track if any transformations occurred for this statement
		if (edits.length > initialEditCount) {
			const importReplacement = createImportReplacement(statement);

			if (importReplacement) {
				edits.push(statement.replace(importReplacement));
			}
		}
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

// Compatibility mapping for chalk properties that differ in util.styleText
const COMPAT_MAP: Record<string, string> = {
	overline: 'overlined',
};

// Chalk methods that are supported by util.styleText
const SUPPORTED_METHODS = new Set([
	// Foreground colors
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
	// Background colors
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
	// Modifiers
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
 * Check if a method name is supported by util.styleText
 */
function isSupportedMethod(method: string): boolean {
	return SUPPORTED_METHODS.has(method);
}

/**
 * Check if a style chain contains any unsupported methods
 */
function hasUnsupportedMethods(styles: string[]): boolean {
	return styles.some((style) => !SUPPORTED_METHODS.has(style));
}

/**
 * Extract destructured import names from a statement
 * Returns an array of {imported, local} objects for each destructured import
 */
function getDestructuredNames(
	statement: SgNode<Js>,
): Array<{ imported: string; local: string }> {
	const names: Array<{ imported: string; local: string }> = [];

	// Handle ESM imports: import { red, blue as foo } from 'chalk'
	if (statement.kind() === 'import_statement') {
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
	}
	// Handle CommonJS requires: const { red, blue: foo } = require('chalk')
	// Handle dynamic imports: const { red, blue: foo } = await import('chalk')
	else if (statement.kind() === 'variable_declarator') {
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
					// { red } - shorthand
					const name = prop.text();

					names.push({ imported: name, local: name });
				} else if (prop.kind() === 'pair_pattern') {
					// { red: foo } - with alias
					const key = prop.field('key');
					const value = prop.field('value');

					if (key && value) {
						const imported = key.text();
						const local = value.text();

						names.push({ imported, local });
					}
				}
			}
		}
	}

	return names;
}

/**
 * Extract the first text argument from a function call
 */
function getFirstCallArgument(call: SgNode<Js>): string | null {
	const args = call.field('arguments');

	if (!args) return null;

	const argsList = args.children().filter((c) => {
		const excluded = [',', '(', ')'];
		return !excluded.includes(c.kind());
	});

	if (argsList.length === 0) return null;

	return argsList[0].text();
}

/**
 * Generate a styleText replacement for a single style
 */
function createStyleTextReplacement(
	styleMethod: string,
	textArg: string,
): string {
	return `styleText("${styleMethod}", ${textArg})`;
}

/**
 * Generate a styleText replacement for multiple styles
 */
function createMultiStyleTextReplacement(
	styles: string[],
	textArg: string,
): string {
	if (styles.length === 1) {
		return createStyleTextReplacement(styles[0], textArg);
	}

	const stylesArray = `[${styles.map((s) => `"${s}"`).join(', ')}]`;

	return `styleText(${stylesArray}, ${textArg})`;
}

/**
 * Process destructured imports and transform direct function calls
 */
function processDestructuredImports(
	rootNode: SgNode<Js>,
	destructuredNames: Array<{ imported: string; local: string }>,
	edits: Edit[],
): void {
	for (const name of destructuredNames) {
		const directCalls = rootNode.findAll({
			rule: {
				kind: 'call_expression',
				has: {
					field: 'function',
					kind: 'identifier',
					pattern: name.local,
				},
			},
		});

		for (const call of directCalls) {
			if (!isSupportedMethod(name.imported)) {
				warnOnUnsupportedMethod(name.imported, rootNode, call);
				continue;
			}

			const textArg = getFirstCallArgument(call);

			if (!textArg) continue;

			const styleMethod = COMPAT_MAP[name.imported] || name.imported;
			const replacement = createStyleTextReplacement(styleMethod, textArg);

			edits.push(call.replace(replacement));
		}
	}
}

/**
 * Process default imports and transform member expression calls
 */
function processDefaultImports(
	rootNode: SgNode<Js>,
	binding: string,
	edits: Edit[],
): void {
	const chalkCalls = rootNode.findAll({
		rule: {
			kind: 'call_expression',
			has: {
				field: 'function',
				kind: 'member_expression',
				has: {
					field: 'object',
					any: [
						// Direct chalk calls
						{
							kind: 'identifier',
							pattern: binding,
						},
						// Chained chalk calls
						{
							kind: 'member_expression',
							any: [
								{
									has: {
										field: 'object',
										kind: 'identifier',
										pattern: binding, // chalk.method1.method2
									},
								},
								{
									has: {
										field: 'object',
										kind: 'member_expression',
										has: {
											field: 'object',
											kind: 'identifier',
											pattern: binding, // chalk.method1.method2.method3
										},
									},
								},
							],
						},
					],
				},
			},
		},
	});

	for (const call of chalkCalls) {
		const functionExpr = call.field('function');

		if (!functionExpr) continue;

		const styles = extractChalkStyles(functionExpr, binding);

		if (styles.length === 0) continue;

		if (hasUnsupportedMethods(styles)) {
			for (const style of styles) {
				if (!SUPPORTED_METHODS.has(style)) {
					warnOnUnsupportedMethod(style, rootNode, call);
				}
			}
			continue;
		}

		const textArg = getFirstCallArgument(call);

		if (!textArg) continue;

		const replacement = createMultiStyleTextReplacement(styles, textArg);

		edits.push(call.replace(replacement));
	}

	// Handle method assignments
	// const red = chalk.red; → const red = (text) => styleText("red", text);
	const methodAssignments = rootNode.findAll({
		rule: {
			kind: 'variable_declarator',
			has: {
				field: 'value',
				any: [{ kind: 'member_expression' }, { kind: 'ternary_expression' }],
			},
		},
	});

	for (const assignment of methodAssignments) {
		const valueExpr = assignment.field('value');
		if (!valueExpr) continue;

		const nameField = assignment.field('name');
		if (!nameField) continue;

		const variableName = nameField.text();

		if (valueExpr.kind() === 'member_expression') {
			// Direct assignment: const red = chalk.red;
			const replacement = createMemberExpressionAssignment(
				valueExpr,
				variableName,
				binding,
			);
			if (replacement) {
				edits.push(assignment.replace(replacement));
			}
		} else if (valueExpr.kind() === 'ternary_expression') {
			// Conditional assignment: const c = b ? chalk.bold : chalk.underline;
			const replacement = createTernaryExpressionAssignment(
				valueExpr,
				variableName,
				binding,
			);
			if (replacement) {
				edits.push(assignment.replace(replacement));
			}
		}
	}
}

/**
 * Replace import/require statement with node:util import
 */
function createImportReplacement(statement: SgNode<Js>): string {
	if (statement.kind() === 'import_statement') {
		return `import { styleText } from "node:util";`;
	}

	if (statement.kind() === 'variable_declarator') {
		// Handle dynamic ESM import
		if (statement.field('value')?.kind() === 'await_expression') {
			return `{ styleText } = await import("node:util")`;
		}
		// Handle CommonJS require
		return `{ styleText } = require("node:util")`;
	}

	return '';
}

/**
 * Traverses a member expression node to extract chained chalk styles.
 * and returns a list of styles in the order they were called.
 */
function extractChalkStyles(node: SgNode<Js>, chalkBinding: string): string[] {
	const styles: string[] = [];

	function traverse(node: SgNode<Js>): boolean {
		const obj = node.field('object');
		const prop = node.field('property');

		if (obj && prop && prop.kind() === 'property_identifier') {
			const propName = prop.text();

			if (obj.kind() === 'identifier' && obj.text() === chalkBinding) {
				// Base case: chalk.method
				styles.push(COMPAT_MAP[propName] || propName);

				return true;
			}

			if (obj.kind() === 'member_expression' && traverse(obj)) {
				// Recursive case: chain.method
				styles.push(COMPAT_MAP[propName] || propName);

				return true;
			}
		}

		return false;
	}

	traverse(node);

	return styles;
}

/**
 * Create a wrapper function for a chalk member expression assignment
 */
function createMemberExpressionAssignment(
	valueExpr: SgNode<Js>,
	variableName: string,
	binding: string,
): string | null {
	const styles = extractChalkStyles(valueExpr, binding);

	if (styles.length === 0) {
		return null;
	}

	if (hasUnsupportedMethods(styles)) {
		return null;
	}

	const styleTextCall = createMultiStyleTextReplacement(styles, 'text');
	const wrapperFunction = `(text) => ${styleTextCall}`;

	return `${variableName} = ${wrapperFunction}`;
}

/**
 * Create wrapper functions for a ternary expression assignment with chalk expressions
 */
function createTernaryExpressionAssignment(
	valueExpr: SgNode<Js>,
	variableName: string,
	binding: string,
): string | null {
	const condition = valueExpr.field('condition');
	const consequent = valueExpr.field('consequence');
	const alternative = valueExpr.field('alternative');

	if (!condition || !consequent || !alternative) {
		return null;
	}

	// Extract styles from both sides if they are member expressions
	if (
		consequent.kind() !== 'member_expression' &&
		alternative.kind() !== 'member_expression'
	) {
		return null;
	}

	const consequentStyles = extractChalkStyles(consequent, binding);
	const alternativeStyles = extractChalkStyles(alternative, binding);

	// Only transform if both sides are chalk expressions
	if (consequentStyles.length === 0 || alternativeStyles.length === 0) {
		return null;
	}

	if (hasUnsupportedMethods([...consequentStyles, ...alternativeStyles])) {
		return null;
	}

	const consequentCall = createMultiStyleTextReplacement(
		consequentStyles,
		'text',
	);
	const alternativeCall = createMultiStyleTextReplacement(
		alternativeStyles,
		'text',
	);
	const conditionText = condition.text();

	return `${variableName} = ${conditionText} ? (text) => ${consequentCall} : (text) => ${alternativeCall}`;
}

/**
 * Utility to warn the user about unsupported chalk methods.
 */
function warnOnUnsupportedMethod(
	method: string,
	rootNode: SgNode<Js>,
	node: SgNode<Js>,
) {
	const filename = rootNode.getRoot().filename();
	const { start } = node.range();

	console.warn(
		`${filename}:${start.line}:${start.column}: uses chalk method '${method}' that does not have any equivalent in util.styleText please review this line`,
	);
}

import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import type { Edit, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';

const ANSI_COLORS_BINDING = 'ansi-colors';

const SUPPORTED_METHODS = new Set([
	'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
	'gray', 'grey', 'blackBright', 'redBright', 'greenBright', 'yellowBright',
	'blueBright', 'magentaBright', 'cyanBright', 'whiteBright',
	'bgBlack', 'bgRed', 'bgGreen', 'bgYellow', 'bgBlue', 'bgMagenta', 'bgCyan', 'bgWhite',
	'bgGray', 'bgGrey', 'bgBlackBright', 'bgRedBright', 'bgGreenBright', 'bgYellowBright',
	'bgBlueBright', 'bgMagentaBright', 'bgCyanBright', 'bgWhiteBright',
	'reset', 'bold', 'dim', 'italic', 'underline', 'inverse', 'hidden',
	'strikethrough', 'overline', 'blink', 'doubleunderline', 'framed',
]);

const COMPATIBILITY_MAP: Record<string, string> = {
	gray: 'blackBright',
	grey: 'blackBright',
};

const UNSUPPORTED_API_WARNINGS: Record<string, string> = {
	enabled: `util.styleText has no equivalent runtime instance flag. Map this configuration to environment variables instead: set process.env.NO_COLOR='1' or NODE_DISABLE_COLORS='1' before application initialization.`,
	visible: `util.styleText lacks a visual toggling mechanism and will always return a string wrapper. Please guard the call site explicitly: const out = visible ? styleText('red', msg) : '';`,
	unstyle: `util.styleText does not expose an ANSI text stripper. Replace with a native regex str.replace(/\\x1b\\[[0-9;]*m/g, '') or install a zero-dependency package like strip-ansi.`,
	stripColor: `util.styleText does not expose an ANSI text stripper. Replace with a native regex str.replace(/\\x1b\\[[0-9;]*m/g, '') or install a zero-dependency package like strip-ansi.`,
	hasAnsi: `util.styleText does not expose an ANSI text stripper. Replace with a native regex str.replace(/\\x1b\\[[0-9;]*m/g, '') or install a zero-dependency package like strip-ansi.`,
	hasColor: `util.styleText does not expose an ANSI text stripper. Replace with a native regex str.replace(/\\x1b\\[[0-9;]*m/g, '') or install a zero-dependency package like strip-ansi.`,
	alias: `util.styleText is stateless and does not maintain a style or theme registry. Migrate global configurations to dedicated structural objects mapping keys to arrow functions (e.g., const theme = { error: (m) => styleText(['bold', 'red'], m) }).`,
	theme: `util.styleText is stateless and does not maintain a style or theme registry. Migrate global configurations to dedicated structural objects mapping keys to arrow functions (e.g., const theme = { error: (m) => styleText(['bold', 'red'], m) }).`,
	create: `util.styleText is stateless and does not maintain a style or theme registry. Migrate global configurations to dedicated structural objects mapping keys to arrow functions (e.g., const theme = { error: (m) => styleText(['bold', 'red'], m) }).`,
	define: `util.styleText is stateless and does not maintain a style or theme registry. Migrate global configurations to dedicated structural objects mapping keys to arrow functions (e.g., const theme = { error: (m) => styleText(['bold', 'red'], m) }).`,
};

const UNSUPPORTED_APIS = new Set(Object.keys(UNSUPPORTED_API_WARNINGS));

export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const statements = getModuleDependencies(root, ANSI_COLORS_BINDING);

	if (!statements.length) return null;

	for (const statement of statements) {
		const initialEditCount = edits.length;
		const destructuredNames = getDestructuredNames(statement);

		if (destructuredNames.length > 0) {
			processDestructuredImports(rootNode, destructuredNames, edits);
		} else {
			const binding = resolveBindingPath(statement, '$');
			if (binding) {
				checkUnsupportedApis(rootNode, binding, root);
				processDefaultImports(rootNode, binding, edits);
			}
		}

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

function normalizeStyle(style: string): string {
	return COMPATIBILITY_MAP[style] ?? style;
}

function createImportReplacement(statement: SgNode<Js>): string {
	if (statement.kind() === 'import_statement') {
		return `import { styleText } from 'node:util';`;
	}

	if (statement.kind() === 'variable_declarator') {
		if (statement.field('value')?.kind() === 'await_expression') {
			return `{ styleText } = await import('node:util')`;
		}
		return `{ styleText } = require('node:util')`;
	}

	return '';
}

function getDestructuredNames(
	statement: SgNode<Js>,
): Array<{ imported: string; local: string }> {
	const names: Array<{ imported: string; local: string }> = [];

	if (statement.kind() === 'import_statement') {
		const namedImports = statement.find({ rule: { kind: 'named_imports' } });

		if (namedImports) {
			for (const specifier of namedImports.findAll({ rule: { kind: 'import_specifier' } })) {
				const importedName = specifier.field('name');
				const alias = specifier.field('alias');

				if (importedName) {
					const imported = importedName.text();
					const local = alias ? alias.text() : imported;
					if (SUPPORTED_METHODS.has(imported)) {
						names.push({ imported: normalizeStyle(imported), local });
					}
				}
			}
		}
	} else if (statement.kind() === 'variable_declarator') {
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
					if (SUPPORTED_METHODS.has(name)) {
						names.push({ imported: normalizeStyle(name), local: name });
					}
				} else if (prop.kind() === 'pair_pattern') {
					const key = prop.field('key');
					const value = prop.field('value');
					if (key && value) {
						const imported = key.text();
						const local = value.text();
						if (SUPPORTED_METHODS.has(imported)) {
							names.push({ imported: normalizeStyle(imported), local });
						}
					}
				}
			}
		}
	}

	return names;
}

function extractChainedStyles(node: SgNode<Js>, binding: string): string[] | null {
	const objectNode = node.field('object');
	const propertyNode = node.field('property');

	if (!objectNode || !propertyNode || propertyNode.kind() !== 'property_identifier') {
		return null;
	}

	const propertyName = normalizeStyle(propertyNode.text());

	if (objectNode.kind() === 'identifier') {
		if (objectNode.text() !== binding) return null;
		if (!SUPPORTED_METHODS.has(propertyNode.text()) && !COMPATIBILITY_MAP[propertyNode.text()]) return null;
		return [propertyName];
	}

	if (objectNode.kind() === 'member_expression') {
		const nested = extractChainedStyles(objectNode, binding);
		if (!nested) return null;
		if (!SUPPORTED_METHODS.has(propertyNode.text()) && !COMPATIBILITY_MAP[propertyNode.text()]) return null;
		return [...nested, propertyName];
	}

	return null;
}

function checkUnsupportedApis(rootNode: SgNode<Js>, binding: string, root: SgRoot<Js>): void {
	const memberExpressions = rootNode.findAll({
		rule: { kind: 'member_expression' },
	});

	for (const memberExpr of memberExpressions) {
		const objectNode = memberExpr.field('object');
		const propertyNode = memberExpr.field('property');

		if (!objectNode || !propertyNode) continue;
		if (objectNode.text() !== binding) continue;
		if (propertyNode.kind() !== 'property_identifier') continue;

		const propertyName = propertyNode.text();
		if (!UNSUPPORTED_APIS.has(propertyName)) continue;

		const filename = root.filename();
		const { start } = memberExpr.range();
		const message = UNSUPPORTED_API_WARNINGS[propertyName];
		console.warn(`${filename}:${start.line}:${start.column}: ${message}`);
	}
}

function processDestructuredImports(
	rootNode: SgNode<Js>,
	destructuredNames: Array<{ imported: string; local: string }>,
	edits: Edit[],
): void {
	for (const { local, imported } of destructuredNames) {
		const calls = rootNode.findAll({
			rule: {
				kind: 'call_expression',
				pattern: `${local}($$$ARGS)`,
			},
		});

		for (const call of calls) {
			const args = call.field('arguments');
			if (args) {
				edits.push(call.replace(`styleText('${imported}', ${args.text().slice(1, -1)})`));
			}
		}
	}
}

function processDefaultImports(
	rootNode: SgNode<Js>,
	binding: string,
	edits: Edit[],
): void {
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
		const functionNode = call.field('function');
		if (!functionNode || functionNode.kind() !== 'member_expression') continue;

		const styles = extractChainedStyles(functionNode, binding);
		if (!styles || !styles.length) continue;

		const args = call.field('arguments');
		if (!args) continue;

		const textArg = args.text().slice(1, -1);

		if (styles.length === 1) {
			edits.push(call.replace(`styleText('${styles[0]}', ${textArg})`));
		} else {
			const styleArray = styles.map(s => `'${s}'`).join(', ');
			edits.push(call.replace(`styleText([${styleArray}], ${textArg})`));
		}
	}
}
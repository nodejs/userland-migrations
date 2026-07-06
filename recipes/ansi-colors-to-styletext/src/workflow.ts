import type { Edit, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';

const ANSI_COLORS_BINDING = 'ansi-colors';

const COMPATIBILITY_MAP = {
	gray: 'blackBright',
	grey: 'blackBright',
};

const UNSUPPORTED_API_WARNINGS = {
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

const UNSUPPORTED_APIS = Object.keys(UNSUPPORTED_API_WARNINGS);

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
			const binding = getDefaultBinding(statement);
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

/**
 * Builds the replacement import line based on whether the original was ESM, CJS, or dynamic.
 */
function createImportReplacement(statement: SgNode<Js>): string {
	const kind = statement.kind();

	if (kind === 'import_statement') {
		return `import { styleText } from 'node:util';`;
	}

	if (kind === 'variable_declarator') {
		if (statement.field('value')?.kind() === 'await_expression') {
			return `{ styleText } = await import('node:util')`;
		}
		return `{ styleText } = require('node:util')`;
	}

	return '';
}

/**
 * Resolves the local binding name for default and namespace imports.
 */
function getDefaultBinding(statement: SgNode<Js>): string | null {
	const kind = statement.kind();

	if (kind === 'import_statement') {
		const defaultImport = statement.find({
			rule: {
				kind: 'identifier',
				inside: {
					kind: 'import_clause',
					not: {
						any: [
							{ has: { kind: 'named_imports' } },
							{ has: { kind: 'namespace_import' } },
						],
					},
				},
			},
		});
		if (defaultImport) return defaultImport.text();

		const namespaceImport = statement.find({
			rule: {
				kind: 'identifier',
				inside: { kind: 'namespace_import' },
			},
		});
		return namespaceImport?.text() ?? null;
	}

	if (kind === 'variable_declarator') {
		const nameField = statement.field('name');
		if (nameField?.kind() === 'identifier') return nameField.text();
	}

	return null;
}

/**
 * Collects named import bindings from ESM and CJS destructured statements.
 */
function getDestructuredNames(
	statement: SgNode<Js>,
): Array<{ imported: string; local: string }> {
	const names: Array<{ imported: string; local: string }> = [];
	const kind = statement.kind();

	if (kind === 'import_statement') {
		const namedImports = statement.find({ rule: { kind: 'named_imports' } });

		if (namedImports) {
			for (const specifier of namedImports.findAll({ rule: { kind: 'import_specifier' } })) {
				const importedName = specifier.field('name');
				const alias = specifier.field('alias');

				if (importedName) {
					const imported = importedName.text();
					const local = alias ? alias.text() : imported;
					const mappedImported = COMPATIBILITY_MAP[imported as keyof typeof COMPATIBILITY_MAP];
					names.push({ imported: mappedImported ?? imported, local });
				}
			}
		}
	} else if (kind === 'variable_declarator') {
		const nameField = statement.field('name');

		if (nameField?.kind() === 'object_pattern') {
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
					const mappedImported = COMPATIBILITY_MAP[name as keyof typeof COMPATIBILITY_MAP];
					names.push({ imported: mappedImported ?? name, local: name });
				} else if (prop.kind() === 'pair_pattern') {
					const key = prop.field('key');
					const value = prop.field('value');
					if (key && value) {
						const imported = key.text();
						const mappedImported = COMPATIBILITY_MAP[imported as keyof typeof COMPATIBILITY_MAP];
						names.push({ imported: mappedImported ?? imported, local: value.text() });
					}
				}
			}
		}
	}

	return names;
}

/**
 * Walks a member expression chain and returns the ordered style names,
 * or null if the chain doesn't start from the expected binding.
 */
function extractChainedStyles(node: SgNode<Js>, binding: string): string[] | null {
	const objectNode = node.field('object');
	const propertyNode = node.field('property');

	if (!objectNode || !propertyNode || propertyNode.kind() !== 'property_identifier') {
		return null;
	}

	const propertyName = propertyNode.text();

	if (UNSUPPORTED_APIS.includes(propertyName)) return null;

	const normalizedName = COMPATIBILITY_MAP[propertyName as keyof typeof COMPATIBILITY_MAP] ?? propertyName;

	if (objectNode.kind() === 'identifier') {
		if (objectNode.text() !== binding) return null;
		return [normalizedName];
	}

	if (objectNode.kind() === 'member_expression') {
		const nested = extractChainedStyles(objectNode, binding);
		if (!nested) return null;
		return [...nested, normalizedName];
	}

	return null;
}

/**
 * Emits targeted warnings for ansi-colors APIs with no util.styleText equivalent.
 */
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
		if (!UNSUPPORTED_APIS.includes(propertyName)) continue;

		const filename = root.filename();
		const { start } = memberExpr.range();
		const message = UNSUPPORTED_API_WARNINGS[propertyName as keyof typeof UNSUPPORTED_API_WARNINGS];
		console.warn(`${filename}:${start.line}:${start.column}: ${message}`);
	}
}

/**
 * Transforms calls from destructured bindings — red('text') becomes styleText('red', 'text').
 */
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

/**
 * Transforms chained member calls — ac.bold.red('text') becomes styleText(['bold', 'red'], 'text').
 */
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
		if (functionNode?.kind() !== 'member_expression') continue;

		const styles = extractChainedStyles(functionNode, binding);
		if (!styles?.length) continue;

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
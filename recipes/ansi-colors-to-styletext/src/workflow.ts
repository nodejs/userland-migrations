import type { Edit, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';

const ANSI_COLORS_BINDING = 'ansi-colors';

const COMPATIBILITY_MAP = {
	gray: 'blackBright',
	grey: 'blackBright',
};

const API_REPLACEMENTS = {
	unstyle: 'stripVTControlCharacters',
};

const UNSUPPORTED_API_WARNINGS = {
	enabled: `util.styleText has no equivalent runtime instance flag. Map this configuration to environment variables instead: set process.env.NO_COLOR='1' or NODE_DISABLE_COLORS='1' before application initialization.`,
	visible: `util.styleText lacks a visual toggling mechanism and will always return a string wrapper. Please guard the call site explicitly: const out = visible ? styleText('red', msg) : '';`,
	stripColor: `util.styleText does not expose an ANSI text stripper. Replace with a native regex str.replace(/\\x1b\\[[0-9;]*m/g, '') or install a zero-dependency package like strip-ansi.`,
	hasAnsi: `util.styleText does not expose an ANSI text stripper. Replace with a native regex str.replace(/\\x1b\\[[0-9;]*m/g, '') or install a zero-dependency package like strip-ansi.`,
	hasColor: `util.styleText does not expose an ANSI text stripper. Replace with a native regex str.replace(/\\x1b\\[[0-9;]*m/g, '') or install a zero-dependency package like strip-ansi.`,
	alias: `util.styleText is stateless and does not maintain a style or theme registry. Migrate global configurations to dedicated structural objects mapping keys to arrow functions (e.g., const theme = { error: (m) => styleText(['bold', 'red'], m) }).`,
	theme: `util.styleText is stateless and does not maintain a style or theme registry. Migrate global configurations to dedicated structural objects mapping keys to arrow functions (e.g., const theme = { error: (m) => styleText(['bold', 'red'], m) }).`,
	create: `util.styleText is stateless and does not maintain a style or theme registry. Migrate global configurations to dedicated structural objects mapping keys to arrow functions (e.g., const theme = { error: (m) => styleText(['bold', 'red'], m) }).`,
	define: `util.styleText is stateless and does not maintain a style or theme registry. Migrate global configurations to dedicated structural objects mapping keys to arrow functions (e.g., const theme = { error: (m) => styleText(['bold', 'red'], m) }).`,
};

const UNSUPPORTED_APIS = Object.keys(UNSUPPORTED_API_WARNINGS);

type RequiredApi = 'styleText' | 'stripVTControlCharacters';

/**
 * Main codemod entry point.
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const requiredApis = new Set<RequiredApi>();
	const statements = getModuleDependencies(root, ANSI_COLORS_BINDING);

	if (!statements.length) return null;

	for (const statement of statements) {
		const initialEditCount = edits.length;
		const destructuredNames = getDestructuredNames(statement);

		if (destructuredNames.length > 0) {
			processDestructuredImports(
				rootNode,
				destructuredNames,
				edits,
				requiredApis,
			);
		} else {
			const binding = getDefaultBinding(statement);

			if (binding) {
				checkUnsupportedApis(rootNode, binding, root);

				processDefaultImports(
					rootNode,
					binding,
					edits,
					requiredApis,
				);
			}
		}

		if (edits.length > initialEditCount) {
			const importReplacement = createImportReplacement(
				statement,
				requiredApis,
			);

			if (importReplacement) {
				edits.push(statement.replace(importReplacement));
			}
		}
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

/**
 * Builds the replacement import line based on whether the original was
 * ESM, CJS, or dynamic.
 */
function createImportReplacement(
	statement: SgNode<Js>,
	requiredApis: Set<RequiredApi>,
): string {
	const imports = [...requiredApis].join(', ');

	if (!imports) return '';

	const kind = statement.kind();

	if (kind === 'import_statement') {
		return `import { ${imports} } from 'node:util';`;
	}

	if (kind === 'variable_declarator') {
		if (statement.field('value')?.kind() === 'await_expression') {
			return `{ ${imports} } = await import('node:util')`;
		}

		return `{ ${imports} } = require('node:util')`;
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

		if (nameField?.kind() === 'identifier') {
			return nameField.text();
		}
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
		const namedImports = statement.find({
			rule: { kind: 'named_imports' },
		});

		if (namedImports) {
			for (const specifier of namedImports.findAll({
				rule: { kind: 'import_specifier' },
			})) {
				const importedName = specifier.field('name');
				const alias = specifier.field('alias');

				if (importedName) {
					const imported = importedName.text();
					const local = alias ? alias.text() : imported;
					const mappedImported =
						COMPATIBILITY_MAP[
							imported as keyof typeof COMPATIBILITY_MAP
						];

					names.push({
						imported: mappedImported ?? imported,
						local,
					});
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
				if (
					prop.kind() ===
					'shorthand_property_identifier_pattern'
				) {
					const name = prop.text();
					const mappedImported =
						COMPATIBILITY_MAP[
							name as keyof typeof COMPATIBILITY_MAP
						];

					names.push({
						imported: mappedImported ?? name,
						local: name,
					});
				} else if (prop.kind() === 'pair_pattern') {
					const key = prop.field('key');
					const value = prop.field('value');

					if (key && value) {
						const imported = key.text();
						const mappedImported =
							COMPATIBILITY_MAP[
								imported as keyof typeof COMPATIBILITY_MAP
							];

						names.push({
							imported: mappedImported ?? imported,
							local: value.text(),
						});
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
function extractChainedStyles(
	node: SgNode<Js>,
	binding: string,
): string[] | null {
	const objectNode = node.field('object');
	const propertyNode = node.field('property');

	if (
		!objectNode ||
		!propertyNode ||
		propertyNode.kind() !== 'property_identifier'
	) {
		return null;
	}

	const propertyName = propertyNode.text();

	if (
		UNSUPPORTED_APIS.includes(propertyName) ||
		propertyName in API_REPLACEMENTS
	) {
		return null;
	}

	const normalizedName =
		COMPATIBILITY_MAP[
			propertyName as keyof typeof COMPATIBILITY_MAP
		] ?? propertyName;

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
function checkUnsupportedApis(
	rootNode: SgNode<Js>,
	binding: string,
	root: SgRoot<Js>,
): void {
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

		// `unstyle` has a native Node.js equivalent, so it should not
		// produce an unsupported API warning.
		if (propertyName in API_REPLACEMENTS) continue;

		if (!UNSUPPORTED_APIS.includes(propertyName)) continue;

		const filename = root.filename();
		const { start } = memberExpr.range();
		const message =
			UNSUPPORTED_API_WARNINGS[
				propertyName as keyof typeof UNSUPPORTED_API_WARNINGS
			];

		console.warn(
			`${filename}:${start.line}:${start.column}: ${message}`,
		);
	}
}

/**
 * Transforms calls from destructured bindings.
 *
 * red('text') becomes:
 * styleText('red', 'text')
 *
 * unstyle('text') becomes:
 * stripVTControlCharacters('text')
 */
function processDestructuredImports(
	rootNode: SgNode<Js>,
	destructuredNames: Array<{ imported: string; local: string }>,
	edits: Edit[],
	requiredApis: Set<RequiredApi>,
): void {
	for (const { local, imported } of destructuredNames) {
		const replacement = API_REPLACEMENTS[
			imported as keyof typeof API_REPLACEMENTS
		];

		const calls = rootNode.findAll({
			rule: {
				kind: 'call_expression',
				pattern: `${local}($$$ARGS)`,
			},
		});

		for (const call of calls) {
			const args = call.field('arguments');

			if (!args) continue;

			const textArg = args.text().slice(1, -1);

			if (replacement) {
				requiredApis.add(
					replacement as RequiredApi,
				);

				edits.push(
					call.replace(
						`${replacement}(${textArg})`,
					),
				);
			} else {
				requiredApis.add('styleText');

				edits.push(
					call.replace(
						`styleText('${imported}', ${textArg})`,
					),
				);
			}
		}
	}
}

/**
 * Represents the transformation that can be applied to an ansi-colors
 * call expression.
 */
type CallTransformation = {
	replacement: string;
	requiredApis: RequiredApi[];
};

/**
 * Returns the transformation for a call expression if it is an
 * ansi-colors call belonging to the provided binding.
 *
 * Examples:
 *
 * colors.unstyle(value)
 * ->
 * stripVTControlCharacters(value)
 *
 * colors.bold.red(value)
 * ->
 * styleText(['bold', 'red'], value)
 */
function getCallTransformation(
	call: SgNode<Js>,
	binding: string,
): CallTransformation | null {
	const functionNode = call.field('function');

	if (functionNode?.kind() !== 'member_expression') {
		return null;
	}

	const propertyNode = functionNode.field('property');
	const objectNode = functionNode.field('object');

	if (
		propertyNode?.kind() === 'property_identifier' &&
		propertyNode.text() in API_REPLACEMENTS &&
		objectNode?.kind() === 'identifier' &&
		objectNode.text() === binding
	) {
		const replacement =
			API_REPLACEMENTS[
				propertyNode.text() as keyof typeof API_REPLACEMENTS
			];

		return {
			replacement,
			requiredApis: [replacement as RequiredApi],
		};
	}

	const styles = extractChainedStyles(
		functionNode,
		binding,
	);

	if (!styles?.length) return null;

	const styleTextArgument =
		styles.length === 1
			? `'${styles[0]}'`
			: `[${styles.map(style => `'${style}'`).join(', ')}]`;

	return {
		replacement: `styleText(${styleTextArgument}`,
		requiredApis: ['styleText'],
	};
}

/**
 * Compares two AST positions.
 */
function positionBeforeOrEqual(
	a: { line: number; column: number },
	b: { line: number; column: number },
): boolean {
	return (
		a.line < b.line ||
		(a.line === b.line && a.column <= b.column)
	);
}

/**
 * Returns true when `outer` completely contains `inner`.
 */
function rangeContains(
	outer: ReturnType<SgNode<Js>['range']>,
	inner: ReturnType<SgNode<Js>['range']>,
): boolean {
	return (
		positionBeforeOrEqual(outer.start, inner.start) &&
		positionBeforeOrEqual(inner.end, outer.end)
	);
}

/**
 * Returns only the outermost relevant calls from a collection of calls.
 *
 * This prevents overlapping edits such as:
 *
 * colors.unstyle(colors.bold('hello'))
 *
 * from producing separate edits for both calls.
 *
 * The outer call is edited once, and its nested calls are rendered
 * recursively.
 */
function getOutermostCalls(
	calls: SgNode<Js>[],
): SgNode<Js>[] {
	return calls.filter(call => {
		const callRange = call.range();

		return !calls.some(other => {
			if (other === call) return false;

			const otherRange = other.range();

			if (!rangeContains(otherRange, callRange)) {
				return false;
			}

			// Equal ranges are not considered containment.
			return (
				otherRange.start.line !== callRange.start.line ||
				otherRange.start.column !== callRange.start.column ||
				otherRange.end.line !== callRange.end.line ||
				otherRange.end.column !== callRange.end.column
			);
		});
	});
}

/**
 * Returns relevant nested calls that are not themselves contained by
 * another relevant nested call.
 *
 * For:
 *
 * colors.unstyle(
 *   colors.bold(
 *     colors.blue('hello')
 *   )
 * )
 *
 * the first level returned here is `colors.bold(...)`.
 * `colors.blue(...)` is handled recursively by that call.
 */
function getOutermostNestedCalls(
	args: SgNode<Js>,
	binding: string,
): SgNode<Js>[] {
	const candidates = args.findAll({
		rule: { kind: 'call_expression' },
	}).filter(call => {
		return getCallTransformation(call, binding) !== null;
	});

	return getOutermostCalls(candidates);
}

/**
 * Recursively transforms ansi-colors calls nested inside an argument list.
 *
 * This is the important part for cases such as:
 *
 * colors.unstyle(colors.bold.blue('\u001b[34mhello\u001b[39m'))
 *
 * which becomes:
 *
 * stripVTControlCharacters(styleText(['bold', 'blue'], '\u001b[34mhello\u001b[39m'))
 *
 * The ANSI escape sequences are intentionally preserved here because
 * `stripVTControlCharacters` is the outer operation that removes them.
 */
function transformNestedArguments(
	args: SgNode<Js>,
	binding: string,
	requiredApis: Set<RequiredApi>,
): string {
	let text = args.text().slice(1, -1);

	const nestedCalls = getOutermostNestedCalls(
		args,
		binding,
	);

	if (!nestedCalls.length) {
		return text;
	}

	/**
	 * `args.text()` and the nested call texts are both sourced from the
	 * same original AST, so processing the calls in source order lets us
	 * safely replace repeated nested expressions as well.
	 */
	nestedCalls.sort((a, b) => {
		const aRange = a.range();
		const bRange = b.range();

		if (aRange.start.line !== bRange.start.line) {
			return aRange.start.line - bRange.start.line;
		}

		return aRange.start.column - bRange.start.column;
	});

	let searchFrom = 0;

	for (const nestedCall of nestedCalls) {
		const originalText = nestedCall.text();
		const transformedText = transformCallExpression(
			nestedCall,
			binding,
			requiredApis,
		);

		if (transformedText === originalText) continue;

		const index = text.indexOf(
			originalText,
			searchFrom,
		);

		if (index === -1) continue;

		text =
			text.slice(0, index) +
			transformedText +
			text.slice(index + originalText.length);

		searchFrom =
			index +
			transformedText.length;
	}

	return text;
}

/**
 * Recursively transforms one ansi-colors call expression.
 *
 * This function does not create an AST edit itself. It renders the
 * transformed call as a string so an outer call can incorporate the
 * transformed result into its own replacement.
 */
function transformCallExpression(
	call: SgNode<Js>,
	binding: string,
	requiredApis: Set<RequiredApi>,
): string {
	const transformation = getCallTransformation(
		call,
		binding,
	);

	if (!transformation) {
		return call.text();
	}

	for (const api of transformation.requiredApis) {
		requiredApis.add(api);
	}

	const args = call.field('arguments');

	if (!args) {
		return call.text();
	}

	const transformedArgs = transformNestedArguments(
		args,
		binding,
		requiredApis,
	);

	if (
		transformation.replacement ===
		'stripVTControlCharacters'
	) {
		return `stripVTControlCharacters(${transformedArgs})`;
	}

	return `${transformation.replacement}, ${transformedArgs})`;
}

/**
 * Transforms chained member calls, including nested ansi-colors calls.
 *
 * ac.bold.red('text') becomes:
 * styleText(['bold', 'red'], 'text')
 *
 * ac.unstyle('text') becomes:
 * stripVTControlCharacters('text')
 *
 * Nested calls are transformed recursively:
 *
 * ac.unstyle(ac.bold.red('text'))
 *
 * becomes:
 * stripVTControlCharacters(styleText(['bold', 'red'], 'text'))
 */
function processDefaultImports(
	rootNode: SgNode<Js>,
	binding: string,
	edits: Edit[],
	requiredApis: Set<RequiredApi>,
): void {
	const calls = rootNode
		.findAll({
			rule: {
				kind: 'call_expression',
				has: {
					field: 'function',
					kind: 'member_expression',
				},
			},
		})
		.filter(call => {
			return getCallTransformation(call, binding) !== null;
		});

	/**
	 * Only edit the outermost relevant call. Nested calls are rendered
	 * recursively as part of the outer replacement, which avoids
	 * overlapping edits.
	 */
	const outermostCalls = getOutermostCalls(calls);

	for (const call of outermostCalls) {
		const replacement = transformCallExpression(
			call,
			binding,
			requiredApis,
		);

		if (replacement === call.text()) continue;

		edits.push(call.replace(replacement));
	}
}

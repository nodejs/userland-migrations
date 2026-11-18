import type { Rule, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

export const getNodeImportStatements = (
	rootNode: SgRoot<Js>,
	nodeModuleName: string,
): SgNode<Js>[] =>
	rootNode.root().findAll({
		rule: {
			kind: 'import_statement',
			has: {
				field: 'source',
				kind: 'string',
				has: {
					kind: 'string_fragment',
					regex: `^(node:)?${nodeModuleName}$`,
				},
			},
			not: {
				pattern: 'import type $$$IMPORTS from $SOURCE',
			}
		},

	});

/**
 * We just catch `variable_declarator` nodes that use `import` to import a module
 * Because a simple `import('nodeAPI')` don't do anything, so in codemod context we don't need to
 * catch those.
 *
 * We also don't catch pending promises, like `const pending = import("node:module");`
 * because it's will became to complex to handle in codemod context. (storing var name, checking is method is used, etc.)
 */
export const getNodeImportCalls = (
	rootNode: SgRoot<Js>,
	nodeModuleName: string,
): SgNode<Js>[] => {
	const variableDeclarator = rootNode.root().findAll({
		rule: {
			kind: 'identifier',
			inside: {
				kind: 'variable_declarator',
				has: {
					kind: 'string',
					has: {
						kind: 'string_fragment',
						regex: `^(node:)?${nodeModuleName}$`,
					},
				},
			},
		},
	});

	const variablesRules: Rule<Js>[] = variableDeclarator.map((variableName) => ({
		has: {
			kind: 'identifier',
			regex: variableName.text(),
		},
	}));

	const dynamicImports = rootNode.root().findAll({
		rule: {
			kind: 'call_expression',
			all: [
				{
					has: {
						field: 'function',
						kind: 'import',
					},
				},
				{
					has: {
						field: 'arguments',
						kind: 'arguments',
						any: [
							{
								has: {
									kind: 'string',
									has: {
										kind: 'string_fragment',
										regex: `^(node:)?${nodeModuleName}$`,
									},
								},
							},
							...variablesRules,
						],
					},
				},
			],
		},
	});

	const nodes: SgNode<Js>[] = [];
	const seen = new Set<string>();

	for (const node of dynamicImports) {
		let curr: SgNode<Js> | null = node.parent();
		while (curr && curr.kind() !== 'program') {
			const kind = curr.kind();
			if (kind === 'variable_declarator') {
				const val = curr.field('value');
				if (val && val.kind() === 'await_expression') {
					const range = curr.range();
					const key = `${range.start.index}-${range.end.index}`;
					if (!seen.has(key)) {
						seen.add(key);
						nodes.push(curr);
					}
				}
				break;
			}
			if (kind === 'expression_statement') {
				const thenBlock = curr.find({
					rule: {
						kind: 'member_expression',
						has: {
							kind: 'property_identifier',
							regex: 'then',
						},
					},
				});
				if (thenBlock !== null) {
					const range = curr.range();
					const key = `${range.start.index}-${range.end.index}`;
					if (!seen.has(key)) {
						seen.add(key);
						nodes.push(curr);
					}
				}
				break;
			}
			curr = curr.parent();
		}
	}

	return nodes;
};

/**
 * Get the default import identifier from an import statement.
 *
 * Example:
 * ```ts
 * // import fs from 'fs';
 * // getDefaultImportIdentifier(importNode) -> identifier node for `fs`
 * ```
 *
 * @param importNode - The `import_statement` or its `import_clause` node
 * @returns The identifier node for the default import, or `null` if none
 */
export const getDefaultImportIdentifier = (
	importNode: SgNode<Js>,
): SgNode<Js> | null =>
	importNode.find({
		rule: {
			kind: 'identifier',
			inside: {
				kind: 'import_clause',
				not: {
					has: {
						kind: 'named_imports',
					},
				},
			},
		},
	});

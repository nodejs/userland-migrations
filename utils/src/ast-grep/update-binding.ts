import type { SgNode, Edit, Range, Kinds, TypesMap } from "@codemod.com/jssg-types/main";

const requireKinds = ["lexical_declaration", "variable_declarator"];
const importKinds = ["import_statement", "import_clause"];

type UpdateBindingReturnType = {
	edit?: Edit;
	lineToRemove?: Range;
};

type UpdateBindingOptions = {
	newBinding: string | undefined;
};

/**
 * Update a specific binding from an import or require statement.
 *
 * Analyzes the provided AST node to find and remove a specific binding from destructured imports.
 * If the binding is the only one in the statement, the entire import line is marked for removal.
 * If there are multiple bindings, only the specified binding is removed from the destructuring pattern.
 *
 * @param node - The AST node representing the import or require statement
 * @param binding - The name of the binding to remove (e.g., "isNativeError")
 * @returns An object containing either an edit operation or a line range to remove, or undefined if no binding found
 *
 * @example
 * ```typescript
 * // Given an import: const {types, isNativeError} = require("node:util")
 * // And binding: "isNativeError"
 * // Returns: an edit object that transforms to: const {types} = require("node:util")
 * ```
 *
 * @example
 * ```typescript
 * // Given an import: const {isNativeError} = require("node:util")
 * // And binding: "isNativeError"
 * // Returns: {lineToRemove: Range} to remove the entire line
 * ```
 *
 * @example
 * ```typescript
 * // Given an import: const util = require("node:util")
 * // And binding: "isNativeError"
 * // Returns: undefined (no destructured binding found)
 * ```
 */
export function updateBinding(
	node: SgNode<TypesMap, Kinds<TypesMap>>,
	binding: string,
	options?: UpdateBindingOptions,
): UpdateBindingReturnType {
	const nodeKind = node.kind().toString();

	const identifier = node.find({
		rule: {
			any: [
				{
					kind: "identifier",
					inside: {
						kind: "variable_declarator",
					},
				},
				{
					kind: "identifier",
					inside: {
						kind: "import_clause",
					},
				},
			],
		},
	});

	if (!options?.newBinding && identifier && identifier.text() === binding) {
		return {
			lineToRemove: node.range(),
		};
	}

	if (requireKinds.includes(nodeKind)) {
		return handleNamedRequireBindings(node, binding, options);
	}

	if (importKinds.includes(nodeKind)) {
		return handleNamedImportBindings(node, binding, options);
	}
}

function handleNamedImportBindings(
	node: SgNode<TypesMap, Kinds<TypesMap>>,
	binding: string,
	options: UpdateBindingOptions,
): UpdateBindingReturnType {
	const namespaceImport = node.find({
		rule: {
			kind: "identifier",
			inside: {
				kind: "namespace_import",
			},
		},
	});

	if (Boolean(namespaceImport) && namespaceImport.text() === binding) {
		if (options?.newBinding) {
			return {
				edit: namespaceImport.replace(options.newBinding),
			};
		}

		return {
			lineToRemove: node.range(),
		};
	}

	const namedImports = node.findAll({
		rule: {
			kind: "import_specifier",
			// ignore imports with alias (renamed imports)
			not: {
				has: {
					field: "alias",
					kind: "identifier",
				},
			},
		},
	});

	for (const namedImport of namedImports) {
		const text = namedImport.text();
		if (text === binding) {
			if (!options?.newBinding && namedImports.length === 1) {
				return {
					lineToRemove: node.range(),
				};
			}

			const namedImportsNode = node.find({
				rule: {
					kind: "named_imports",
				},
			});

			return {
				edit: namedImportsNode.replace(updateObjectPattern(namedImports, binding, options)),
			};
		}
	}

	const renamedImports = node.findAll({
		rule: {
			has: {
				field: "alias",
				kind: "identifier",
			},
		},
	});

	for (const renamedImport of renamedImports) {
		if (renamedImport.text() === binding) {
			if (!options?.newBinding && renamedImports.length === 1 && namedImports.length === 0) {
				return {
					lineToRemove: node.range(),
				};
			}

			const namedImportsNode = node.find({
				rule: {
					kind: "named_imports",
				},
			});

			if (options?.newBinding) {
				for (const renamedImport of renamedImports) {
					if (renamedImport.text() === binding) {
						const importName = renamedImport.parent().find({
							rule: {
								has: {
									field: "name",
									kind: "identifier",
								},
							},
						});
						return {
							edit: importName.replace(options.newBinding),
						};
					}
				}
			} else {
				const aliasStatement = renamedImports.map((alias) => alias.parent());
				const newNamedImports = [...namedImports, ...aliasStatement]
					.map((d) => d.text())
					.filter((d) => d !== renamedImport.parent().text());

				return {
					edit: namedImportsNode.replace(`{ ${newNamedImports.join(", ")} }`),
				};
			}
		}
	}
}

function handleNamedRequireBindings(
	node: SgNode<TypesMap, Kinds<TypesMap>>,
	binding: string,
	options: UpdateBindingOptions,
): UpdateBindingReturnType {
	const objectPattern = node.find({
		rule: {
			kind: "object_pattern",
		},
	});

	if (!objectPattern) return;

	const declarations = node.findAll({
		rule: {
			kind: "shorthand_property_identifier_pattern",
		},
	});

	if (!options?.newBinding && declarations.length === 1) {
		return {
			lineToRemove: node.range(),
		};
	}

	return {
		edit: objectPattern.replace(updateObjectPattern(declarations, binding, options)),
	};
}

function updateObjectPattern(
	previous: SgNode<TypesMap, Kinds<TypesMap>>[],
	binding: string,
	options: UpdateBindingOptions,
): string {
	let newObjectPattern: string[];

	if (options?.newBinding) {
		newObjectPattern = previous.map((d) => {
			const text = d.text();
			if (text === binding) {
				return options.newBinding;
			}
			return text;
		});
	} else {
		newObjectPattern = previous.map((d) => d.text()).filter((d) => d !== binding);
	}

	return `{ ${newObjectPattern.join(", ")} }`;
}

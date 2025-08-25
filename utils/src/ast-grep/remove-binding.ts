import type { SgNode, Edit, Range, Kinds, TypesMap } from "@codemod.com/jssg-types/main";

const requireKinds = ["lexical_declaration", "variable_declarator"];
const importKinds = ["import_statement", "import_clause"];

type RemoveBindingReturnType = {
	edit?: Edit;
	lineToRemove?: Range;
};

/**
 * Removes a specific binding from an import or require statement.
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
export function removeBinding(
	node: SgNode<TypesMap, Kinds<TypesMap>>,
	binding: string,
): RemoveBindingReturnType | undefined {
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

	if (identifier && identifier.text() === binding) {
		return {
			lineToRemove: node.range(),
		};
	}

	if (requireKinds.includes(nodeKind)) {
		return handleNamedRequireBindings(node, binding);
	}

	if (importKinds.includes(nodeKind)) {
		return handleNamedImportBindings(node, binding);
	}
}

function handleNamedImportBindings(
	node: SgNode<TypesMap, Kinds<TypesMap>>,
	binding: string,
): RemoveBindingReturnType | undefined {
	const namespaceImport = node.find({
		rule: {
			kind: "identifier",
			inside: {
				kind: "namespace_import",
			},
		},
	});

	if (Boolean(namespaceImport) && namespaceImport.text() === binding) {
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
			if (namedImports.length === 1) {
				return {
					lineToRemove: node.range(),
				};
			}

			const namedImportsNode = node.find({
				rule: {
					kind: "named_imports",
				},
			});
			const restNamedImports = namedImports.map((d) => d.text()).filter((d) => d !== binding);

			return {
				edit: namedImportsNode.replace(`{ ${restNamedImports.join(", ")} }`),
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
			if (renamedImports.length === 1 && namedImports.length === 0) {
				return {
					lineToRemove: node.range(),
				};
			}

			const namedImportsNode = node.find({
				rule: {
					kind: "named_imports",
				},
			});

			const aliasStatement = renamedImports.map((alias) => alias.parent());

			const restNamedImports = [...namedImports, ...aliasStatement]
				.map((d) => d.text())
				.filter((d) => d !== renamedImport.parent().text());

			return {
				edit: namedImportsNode.replace(`{ ${restNamedImports.join(", ")} }`),
			};
		}
	}
}

function handleNamedRequireBindings(
	node: SgNode<TypesMap, Kinds<TypesMap>>,
	binding: string,
): RemoveBindingReturnType | undefined {
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

	if (declarations.length === 1) {
		return {
			lineToRemove: node.range(),
		};
	}

	if (declarations.length > 1) {
		const restDeclarations = declarations.map((d) => d.text()).filter((d) => d !== binding);

		return {
			edit: objectPattern.replace(`{ ${restDeclarations.join(", ")} }`),
		};
	}
}

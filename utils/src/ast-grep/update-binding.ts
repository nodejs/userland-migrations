import type { SgNode, Edit, Range, Kinds } from "@codemod.com/jssg-types/main";
import type Js from "@codemod.com/jssg-types/langs/javascript";

const requireKinds = ["lexical_declaration", "variable_declarator"];
const importKinds = ["import_statement", "import_clause"];

type UpdateBindingReturnType = {
	edit?: Edit;
	lineToRemove?: Range;
};

type UpdateBindingOptions = {
	old?: string;
	new?: string;
};

/**
 * Update or remove a specific binding from an import or require statement.
 *
 * Analyzes the provided AST node to find and update a specific binding from destructured imports.
 * If `newBinding` is provided in options, the binding will be replaced with the new name.
 * If `newBinding` is not provided, the binding will be removed.
 * If the binding is the only one in the statement and no replacement is provided, the entire import line is marked for removal.
 *
 * @param node - The AST node representing the import or require statement
 * @param options - Optional configuration object
 * @param options.old - The name of the binding to update or remove (e.g., "isNativeError")
 * @param options.new - The new binding name to replace the old one. If not provided, the binding is removed.
 * @returns An object containing either an edit operation or a line range to remove, or undefined if no binding found
 *
 * @example
 * ```typescript
 * // Given an import: const {types, isNativeError} = require("node:util")
 * // And binding: "isNativeError", options: {newBinding: "isError"}
 * // Returns: an edit object that transforms to: const {types, isError} = require("node:util")
 * ```
 *
 * @example
 * ```typescript
 * // Given an import: const {types, isNativeError} = require("node:util")
 * // And binding: "isNativeError", options: undefined
 * // Returns: an edit object that transforms to: const {types} = require("node:util")
 * ```
 *
 * @example
 * ```typescript
 * // Given an import: const {isNativeError} = require("node:util")
 * // And binding: "isNativeError", options: {newBinding: "isError"}
 * // Returns: an edit object that transforms to: const {isError} = require("node:util")
 * ```
 *
 * @example
 * ```typescript
 * // Given an import: const {isNativeError} = require("node:util")
 * // And binding: "isNativeError", options: undefined
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
	node: SgNode<Js>,
	options?: UpdateBindingOptions,
): UpdateBindingReturnType {
	const nodeKind = node.kind().toString();

	const namespaceImport = node.find({
		rule: {
			any: [
				{
					kind: "identifier",
					inside: {
						kind: "variable_declarator",
						// this `not rule` ensures that expressions like `require("something").NamedImport` are ignored
						// because we only want the namespace to be returned here
						not: {
							has: {
								field: "value",
								kind: "member_expression",
							},
						},
						inside: {
							kind: "lexical_declaration",
						},
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

	if (!options?.new && namespaceImport && namespaceImport.text() === options?.old) {
		return {
			lineToRemove: node.range(),
		};
	}

	if (requireKinds.includes(nodeKind)) {
		return handleNamedRequireBindings(node, options);
	}

	if (importKinds.includes(nodeKind)) {
		return handleNamedImportBindings(node, options);
	}
}

function handleNamedImportBindings(
	node: SgNode<Js>,
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

	if (Boolean(namespaceImport) && namespaceImport.text() === options.old) {
		if (options?.new) {
			return {
				edit: namespaceImport.replace(options.new),
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
		if (text === options.old) {
			if (!options?.new && namedImports.length === 1) {
				return {
					lineToRemove: node.range(),
				};
			}

			return {
				edit: updateObjectPattern(namedImports, options.old, options.new),
			};
		}
	}

	const aliasedImports = node.findAll({
		rule: {
			has: {
				field: "alias",
				kind: "identifier",
			},
		},
	});

	for (const renamedImport of aliasedImports) {
		if (renamedImport.text() === options.old) {
			if (!options?.new && aliasedImports.length === 1 && namedImports.length === 0) {
				return {
					lineToRemove: node.range(),
				};
			}

			const namedImportsNode = node.find({
				rule: {
					kind: "named_imports",
				},
			});

			if (options?.new) {
				for (const renamedImport of aliasedImports) {
					if (renamedImport.text() === options.old) {
						const importName = renamedImport.parent().find({
							rule: {
								has: {
									field: "name",
									kind: "identifier",
								},
							},
						});
						return {
							edit: importName.replace(options.new),
						};
					}
				}
			} else {
				const aliasStatement = aliasedImports.map((alias) => alias.parent());
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
	node: SgNode<Js>,
	options: UpdateBindingOptions,
): UpdateBindingReturnType {
	const requireWithMemberExpression = node.find({
		rule: {
			kind: "variable_declarator",
			all: [
				{
					has: {
						field: "name",
						kind: "identifier",
						pattern: options.old,
					},
				},
				{
					has: {
						field: "value",
						kind: "member_expression",
						has: {
							field: "property",
							kind: "property_identifier",
						},
					},
				},
			],
		},
	});

	if (requireWithMemberExpression) {
		if (!options?.new) {
			return {
				lineToRemove: node.range(),
			};
		}

		const reqNode = node.find({
			rule: {
				kind: "call_expression",
				pattern: "require($ARGS)",
			},
		});

		return {
			edit: node.replace(`const { ${options.new} } = ${reqNode.text()};`),
		};
	}

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

	if (!options?.new && declarations.length === 1) {
		return {
			lineToRemove: node.range(),
		};
	}

	return {
		edit: updateObjectPattern(declarations, options.old, options.new),
	};
}

function updateObjectPattern(
	previouses: SgNode<Js>[],
	oldBinding?: string,
	newBinding?: string,
): Edit {
	let newObjectPattern: string[] = [];

	let parentNode;
	for (const previous of previouses) {
		if (!oldBinding) {
			parentNode = previous.parent();
		}
		if (previous.text() === oldBinding) {
			parentNode = previous.parent();
			break;
		}
	}

	const bindings = parentNode.findAll({
		rule: {
			any: [
				{
					kind: "shorthand_property_identifier_pattern",
				},
				{
					kind: "import_specifier",
					not: {
						has: {
							field: "alias",
							kind: "identifier",
						},
					},
				},
			],
		},
	});

	let needAddNewBinding = true;
	for (const binding of bindings) {
		if (binding.text() === oldBinding) {
			continue;
		}

		if (binding.text() === newBinding) {
			needAddNewBinding = false;
		}

		newObjectPattern.push(binding.text());
	}

	if (newBinding && needAddNewBinding) {
		newObjectPattern.push(newBinding);
	}

	return parentNode.replace(`{ ${newObjectPattern.join(", ")} }`);
}

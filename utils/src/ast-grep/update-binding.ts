import type { SgNode, Edit, Range, Kinds } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

const requireKinds = ['lexical_declaration', 'variable_declarator'];
const importKinds = ['import_statement', 'import_clause'];

type UpdateBindingReturnType = {
	edit?: Edit;
	lineToRemove?: Range;
};

type UpdateBindingOptions = {
	old?: string;
	new?: string | string[];
};

/**
 * Update or remove a specific binding from an import or require statement.
 *
 * Analyzes the provided AST node to find and update a specific binding from destructured imports.
 * If `newBinding` is provided in options, the binding will be replaced with the new name(s).
 * If `newBinding` is not provided, the binding will be removed.
 * If the binding is the only one in the statement and no replacement is provided, the entire import line is marked for removal.
 *
 * @param node - The AST node representing the import or require statement
 * @param options - Optional configuration object
 * @param options.old - The name of the binding to update or remove (e.g., "isNativeError")
 * @param options.new - The new binding name(s) to replace the old one. Can be a string or an array of strings for many-to-many replacements. If not provided, the binding is removed.
 * @returns An object containing either an edit operation or a line range to remove, or undefined if no binding found
 *
 * @example
 * ```typescript
 * // Given an import: const {types, isNativeError} = require("node:util")
 * // And options: {old: "isNativeError", new: "isError"}
 * // Returns: an edit object that transforms to: const {types, isError} = require("node:util")
 * ```
 *
 * @example
 * ```typescript
 * // Given an import: const {types, isNativeError} = require("node:util")
 * // And options: {old: "isNativeError"}
 * // Returns: an edit object that transforms to: const {types} = require("node:util")
 * ```
 *
 * @example
 * ```typescript
 * // Given an import: const {fips} = require("node:crypto")
 * // And options: {old: "fips", new: ["getFips", "setFips"]}
 * // Returns: an edit object that transforms to: const {getFips, setFips} = require("node:crypto")
 * ```
 *
 * @example
 * ```typescript
 * // Given an import: const {isNativeError} = require("node:util")
 * // And options: {old: "isNativeError", new: "isError"}
 * // Returns: an edit object that transforms to: const {isError} = require("node:util")
 * ```
 *
 * @example
 * ```typescript
 * // Given an import: const {isNativeError} = require("node:util")
 * // And options: {old: "isNativeError"}
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
					kind: 'identifier',
					inside: {
						kind: 'variable_declarator',
						// this `not rule` ensures that expressions like `require("something").NamedImport` are ignored
						// because we only want the namespace to be returned here
						not: {
							has: {
								field: 'value',
								kind: 'member_expression',
							},
						},
						inside: {
							kind: 'lexical_declaration',
						},
					},
				},
				{
					kind: 'identifier',
					inside: {
						kind: 'import_clause',
					},
				},
			],
		},
	});

	if (
		!options?.new &&
		namespaceImport &&
		namespaceImport.text() === options?.old
	) {
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
			kind: 'identifier',
			inside: {
				kind: 'namespace_import',
			},
		},
	});

	if (Boolean(namespaceImport) && namespaceImport.text() === options.old) {
		if (options?.new) {
			// Namespace imports can only be replaced with a single binding
			const newName = Array.isArray(options.new) ? options.new[0] : options.new;
			return {
				edit: namespaceImport.replace(newName),
			};
		}

		return {
			lineToRemove: node.range(),
		};
	}

	const namedImports = node.findAll({
		rule: {
			kind: 'import_specifier',
			// ignore imports with alias (renamed imports)
			not: {
				has: {
					field: 'alias',
					kind: 'identifier',
				},
			},
		},
	});

	const aliasedImports = node.findAll({
		rule: {
			has: {
				field: 'alias',
				kind: 'identifier',
			},
		},
	});

	for (const renamedImport of aliasedImports) {
		if (renamedImport.text() === options.old) {
			if (
				!options?.new &&
				aliasedImports.length === 1 &&
				namedImports.length === 0
			) {
				return {
					lineToRemove: node.range(),
				};
			}

			const namedImportsNode = node.find({
				rule: {
					kind: 'named_imports',
				},
			});

			if (options?.new) {
				// Handling many-to-many aliased imports
				if (Array.isArray(options.new)) {
					const allSpecifiers = [
						...namedImports,
						...aliasedImports.map((a) => a.parent()),
					];
					const newImports: string[] = [];
					const newBindingsToAdd = new Set(options.new);

					for (const spec of allSpecifiers) {
						if (spec.text() === renamedImport.parent().text()) {
							continue;
						}

						const specText = spec
							.find({ rule: { kind: 'identifier' } })
							?.text();
						if (specText && newBindingsToAdd.has(specText)) {
							newBindingsToAdd.delete(specText);
						}

						newImports.push(spec.text());
					}

					for (const newBinding of newBindingsToAdd) {
						newImports.push(newBinding);
					}

					return {
						edit: namedImportsNode.replace(`{ ${newImports.join(', ')} }`),
					};
				}

				for (const renamedImport of aliasedImports) {
					if (renamedImport.text() === options.old) {
						const importName = renamedImport.parent().find({
							rule: {
								has: {
									field: 'name',
									kind: 'identifier',
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
					edit: namedImportsNode.replace(`{ ${newNamedImports.join(', ')} }`),
				};
			}
		}
	}

	if (namedImports.length !== 0) {
		if (namedImports.length === 1 && !options?.new) {
			return {
				lineToRemove: node.range(),
			};
		}

		const edit = updateObjectPattern(namedImports, options.old, options.new);
		if (edit) return { edit };
	}
}

function handleNamedRequireBindings(
	node: SgNode<Js>,
	options: UpdateBindingOptions,
): UpdateBindingReturnType {
	const requireWithMemberExpression = node.find({
		rule: {
			kind: 'variable_declarator',
			all: [
				{
					has: {
						field: 'name',
						kind: 'identifier',
						pattern: options.old,
					},
				},
				{
					has: {
						field: 'value',
						kind: 'member_expression',
						has: {
							field: 'property',
							kind: 'property_identifier',
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
				kind: 'call_expression',
				pattern: 'require($ARGS)',
			},
		});

		return {
			edit: node.replace(`const { ${options.new} } = ${reqNode.text()};`),
		};
	}

	const objectPattern = node.find({
		rule: {
			kind: 'object_pattern',
		},
	});

	if (!objectPattern) return;

	const allDeclarations = node.findAll({
		rule: {
			any: [
				{ kind: 'shorthand_property_identifier_pattern' },
				{ kind: 'pair_pattern' },
			],
		},
	});

	let effectiveBindingCount = 0;
	for (const decl of allDeclarations) {
		if (decl.kind() === 'pair_pattern') {
			const valueNode = decl
				.children()
				.find((child) => child.kind() === 'identifier');
			if (valueNode) {
				effectiveBindingCount++;
			}
		} else {
			effectiveBindingCount++;
		}
	}

	if (!options?.new && effectiveBindingCount === 1) {
		return {
			lineToRemove: node.range(),
		};
	}

	const result = updateObjectPattern(allDeclarations, options.old, options.new);
	if (result) return { edit: result };
}

function updateObjectPattern(
	previouses: SgNode<Js>[],
	oldBinding?: string,
	newBinding?: string | string[],
): Edit {
	const newObjectPattern: string[] = [];

	let parentNode: SgNode<Js, Kinds<Js>>;

	for (const previous of previouses) {
		if (!oldBinding) {
			parentNode = previous.parent();
			break;
		}

		if (previous.kind() === 'pair_pattern') {
			const keyNode = previous.find({ rule: { kind: 'property_identifier' } });
			const valueNode = previous
				.children()
				.find((child) => child.kind() === 'identifier');
			if (keyNode?.text() === oldBinding || valueNode?.text() === oldBinding) {
				parentNode = previous.parent();
				break;
			}
		} else if (previous.text() === oldBinding) {
			parentNode = previous.parent();
			break;
		}
	}

	if (!parentNode) return;

	const bindings = parentNode.children().filter((child) => {
		const kind = child.kind();
		return (
			kind === 'shorthand_property_identifier_pattern' ||
			kind === 'pair_pattern' ||
			(kind === 'import_specifier' &&
				!child.find({ rule: { has: { field: 'alias', kind: 'identifier' } } }))
		);
	});

	const newBindings = Array.isArray(newBinding)
		? newBinding
		: newBinding
			? [newBinding]
			: [];
	const bindingsToAdd = new Set(newBindings);

	for (const binding of bindings) {
		if (binding.kind() === 'pair_pattern') {
			const keyNode = binding.find({ rule: { kind: 'property_identifier' } });
			const valueNode = binding
				.children()
				.find((child) => child.kind() === 'identifier');
			const key = keyNode?.text();
			const value = valueNode?.text();

			if (key === oldBinding || value === oldBinding) {
				continue;
			}

			if (key && bindingsToAdd.has(key)) {
				bindingsToAdd.delete(key);
			}

			newObjectPattern.push(binding.text());
		} else {
			if (binding.text() === oldBinding) {
				continue;
			}

			if (bindingsToAdd.has(binding.text())) {
				bindingsToAdd.delete(binding.text());
			}

			newObjectPattern.push(binding.text());
		}
	}

	for (const bindingToAdd of bindingsToAdd) {
		newObjectPattern.push(bindingToAdd);
	}

	return parentNode.replace(`{ ${newObjectPattern.join(', ')} }`);
}

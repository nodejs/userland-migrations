import type { SgNode } from "@codemod.com/jssg-types/main";
import type Js from "@codemod.com/jssg-types/langs/javascript";

const requireKinds = ["lexical_declaration", "variable_declarator"];
const importKinds = ["import_statement", "import_clause"];
const supportedKinds = [...requireKinds, ...importKinds];

/**
 * Resolves a global function path to its local binding path based on the import structure in the AST.
 *
 * Takes a dotted path (like `$.types.isNativeError`) and analyzes the provided AST node to determine
 * how that function should be accessed in the local code context based on the import pattern used.
 *
 * @param node - The AST node representing the import or require statement
 * @param path - The expected dotted path to resolve (e.g., "$.types.isNativeError")
 * @returns The local access path that should be used in code (e.g., "types.isNativeError")
 *
 * @example
 * ```typescript
 * // Given an import: const {types} = require("node:util")
 * // And path: "$.types.isNativeError"
 * // Returns: "types.isNativeError"
 * ```
 *
 * @example
 * ```typescript
 * // Given an import: const util = require("node:util")
 * // And path: "$.types.isNativeError"
 * // Returns: "util.types.isNativeError"
 * ```
 *
 * @example
 * ```typescript
 * // Given an import: import {types as utilTypes} from ("node:util")
 * // And path: "$.types.isNativeError"
 * // Returns: "utilTypes.isNativeError"
 * ```
 */
export function resolveBindingPath(node: SgNode<Js>, path: string) {
	const activeNode = node;
	const rootKind = activeNode.kind().toString();

	if (!supportedKinds.includes(rootKind.toString())) {
		throw Error(
			`Invalid node kind. To resolve binding path, one of these types must be provided: ${supportedKinds.join(", ")}`,
		);
	}

	if (importKinds.includes(rootKind)) {
		return resolveBindingPathImport(activeNode, path);
	}

	if (requireKinds.includes(rootKind)) {
		return resolveBindingPathRequire(activeNode, path);
	}
}

function resolveBindingPathRequire(node: SgNode<Js>, path: string) {
	const pathArr = path.split(".");
	let activeNode = node;
	const rootKind = node.kind();

	if (rootKind === "lexical_declaration") {
		activeNode = activeNode.find({
			rule: {
				kind: "variable_declarator",
			},
		});
	}

	activeNode = activeNode.child(0);

	if (activeNode?.kind() === "identifier") {
		return path.replace("$", activeNode.text());
	}

	const namedImports = activeNode.findAll({
		rule: {
			kind: "shorthand_property_identifier_pattern",
		},
	});

	for (const namedImport of namedImports) {
		const text = namedImport.text();
		if (pathArr.includes(text)) return path.slice(path.indexOf(text));
	}

	const renamedImports = activeNode.findAll({
		rule: {
			kind: "pair_pattern",
			all: [
				{
					has: {
						field: "key",
						kind: "property_identifier",
					},
				},
				{
					has: {
						field: "value",
						kind: "identifier",
					},
				},
			],
		},
	});

	for (const rename of renamedImports) {
		const oldNameNode = rename.find({
			rule: {
				kind: "property_identifier",
			},
		});
		const oldName = oldNameNode?.text();

		if (oldName && pathArr.includes(oldName)) {
			const newNameNode = rename.find({
				rule: {
					kind: "identifier",
				},
			});

			const newPath = path.slice(path.indexOf(oldName));
			return newPath.replace(oldName, newNameNode?.text());
		}
	}
}

function resolveBindingPathImport(node: SgNode<Js>, path: string) {
	const pathArr = path.split(".");
	let activeNode = node;
	const rootKind = node.kind();

	if (rootKind === "import_statement") {
		activeNode = activeNode.find({
			rule: {
				kind: "import_clause",
			},
		});
	}

	activeNode = activeNode.child(0);

	if (activeNode?.kind() === "identifier") {
		return path.replace("$", activeNode.text());
	}

	const namespaceImport = activeNode.find({
		rule: {
			kind: "namespace_import",
		},
	});

	if (namespaceImport) {
		const namespaceIdentifier = namespaceImport.find({
			rule: {
				kind: "identifier",
			},
		});

		return path.replace("$", namespaceIdentifier.text());
	}

	const namedImports = activeNode.findAll({
		rule: {
			kind: "import_specifier",
		},
	});

	for (const namedImport of namedImports) {
		const text = namedImport.text();
		if (pathArr.includes(text)) return path.slice(path.indexOf(text));
	}

	const renamedImports = activeNode.findAll({
		rule: {
			kind: "import_specifier",
			all: [
				{
					has: {
						field: "alias",
						kind: "identifier",
					},
				},
				{
					has: {
						field: "name",
						kind: "identifier",
					},
				},
			],
		},
	});

	if (renamedImports.length > 0) {
		for (const renamedImport of renamedImports) {
			const oldNameNode = renamedImport.find({
				rule: {
					has: {
						field: "name",
						kind: "identifier",
					},
				},
			});
			const oldName = oldNameNode?.text();

			if (oldName && pathArr.includes(oldName)) {
				const newNameNode = renamedImport.find({
					rule: {
						has: {
							field: "alias",
							kind: "identifier",
						},
					},
				});

				const newPath = path.slice(path.indexOf(oldName));
				return newPath.replace(oldName, newNameNode?.text());
			}
		}
	}
}

import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";
import { removeLines } from "@nodejs/codemod-utils/ast-grep/remove-lines";
import type { SgRoot, SgNode, Edit, Range } from "@codemod.com/jssg-types/main";
import type Js from "@codemod.com/jssg-types/langs/javascript";

type Binding = {
	type: "namespace" | "destructured";
	binding: string;
	node: SgNode<Js>;
};

/**
 * Transform function that converts deprecated crypto.fips calls
 * to the new crypto.getFips() and crypto.setFips() syntax.
 *
 * Handles:
 * 1. crypto.fips -> crypto.getFips()
 * 2. crypto.fips = value -> crypto.setFips(value)
 * 3. const { fips } = require("crypto") -> const { getFips, setFips } = require("crypto")
 * 4. import { fips } from "crypto" -> import { getFips, setFips } from "crypto"
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	const bindings = collectCryptoFipsBindings(root);

	if (bindings.length === 0) return null;

	for (const binding of bindings) {
		if (binding.type === "namespace") {
			edits.push(...transformNamespaceUsage(rootNode, binding.binding));
		} else {
			edits.push(...transformDestructuredUsage(rootNode, binding.binding));
			const importUpdateResult = updateDestructuredImport(binding.node);
			if (importUpdateResult.edit) {
				edits.push(importUpdateResult.edit);
			}
			if (importUpdateResult.lineToRemove) {
				linesToRemove.push(importUpdateResult.lineToRemove);
			}
		}
	}

	if (edits.length === 0 && linesToRemove.length === 0) return null;

	const sourceCode = rootNode.commitEdits(edits);
	return linesToRemove.length > 0 ? removeLines(sourceCode, linesToRemove) : sourceCode;
}

/**
 * Collect all crypto.fips bindings from the file
 */
function collectCryptoFipsBindings(root: SgRoot<Js>): Binding[] {
	const bindings: Binding[] = [];
	const importNodes = getNodeImportStatements(root, "crypto");
	const requireNodes = getNodeRequireCalls(root, "crypto");
	const allStatements = [...importNodes, ...requireNodes];

	for (const node of allStatements) {
		const resolvedPath = resolveBindingPath(node, "$.fips");

		if (!resolvedPath) continue;

		// If the resolved path contains a dot, it's a namespace import (e.g., "crypto.fips")
		// Otherwise, it's a destructured import (e.g., "fips")
		if (resolvedPath.includes(".")) {
			bindings.push({
				type: "namespace",
				binding: resolvedPath.slice(0, resolvedPath.lastIndexOf(".")),
				node,
			});
		} else {
			bindings.push({
				type: "destructured",
				binding: resolvedPath,
				node,
			});
		}
	}

	return bindings;
}

/**
 * Transform namespace usage: crypto.fips -> crypto.getFips(), crypto.fips = val -> crypto.setFips(val)
 */
function transformNamespaceUsage(rootNode: SgNode<Js>, base: string): Edit[] {
	const edits: Edit[] = [];

	// Handle assignments: crypto.fips = value
	const assignments = rootNode.findAll({
		rule: { pattern: `${base}.fips = $VALUE` },
	});

	for (const assignment of assignments) {
		const valueNode = assignment.getMatch("VALUE");
		if (valueNode) {
			let value = valueNode.text();
			// Replace any crypto.fips references within the value itself
			value = value.replace(
				new RegExp(`\\b${escapeRegExp(base)}\\.fips\\b`, "g"),
				`${base}.getFips()`,
			);
			edits.push(assignment.replace(`${base}.setFips(${value})`));
		}
	}

	// Handle reads: crypto.fips (but not assignments, which we already handled)
	const reads = rootNode.findAll({
		rule: {
			pattern: `${base}.fips`,
			not: {
				inside: {
					kind: "assignment_expression",
					has: {
						field: "left",
						pattern: `${base}.fips`,
					},
				},
			},
		},
	});

	for (const read of reads) {
		edits.push(read.replace(`${base}.getFips()`));
	}

	return edits;
}

/**
 * Transform destructured usage: fips -> getFips(), fips = val -> setFips(val)
 */
function transformDestructuredUsage(rootNode: SgNode<Js>, binding: string): Edit[] {
	const edits: Edit[] = [];

	// Handle assignments: fips = value
	const assignments = rootNode.findAll({
		rule: {
			pattern: `${binding} = $VALUE`,
		},
	});

	for (const assignment of assignments) {
		const valueNode = assignment.getMatch("VALUE");
		if (valueNode) {
			let value = valueNode.text();
			// Replace any references to the binding within the value itself
			value = value.replace(new RegExp(`\\b${escapeRegExp(binding)}\\b`, "g"), "getFips()");
			edits.push(assignment.replace(`setFips(${value})`));
		}
	}

	// Handle reads: fips (but not assignments or in import/require statements)
	const reads = rootNode.findAll({
		rule: {
			kind: "identifier",
			pattern: binding,
			not: {
				inside: {
					any: [
						{
							kind: "assignment_expression",
							has: {
								kind: "identifier",
								pattern: binding,
							},
						},
						{ kind: "import_statement" },
						{ kind: "variable_declarator" },
					],
				},
			},
		},
	});

	for (const read of reads) {
		edits.push(read.replace("getFips()"));
	}

	return edits;
}

/**
 * Update destructured import/require to replace fips with getFips and setFips
 */
function updateDestructuredImport(node: SgNode<Js>): { edit?: Edit; lineToRemove?: Range } {
	const nodeKind = node.kind().toString();

	// Handle require statements
	if (nodeKind === "lexical_declaration" || nodeKind === "variable_declarator") {
		return updateRequireDestructuring(node);
	}

	// Handle import statements
	if (nodeKind === "import_statement" || nodeKind === "import_clause") {
		return updateImportSpecifiers(node);
	}

	return {};
}

/**
 * Update require destructuring: const { fips } = require("crypto")
 */
function updateRequireDestructuring(node: SgNode<Js>): { edit?: Edit; lineToRemove?: Range } {
	const objPattern = node.find({ rule: { kind: "object_pattern" } });
	if (!objPattern) return {};

	const props = objPattern.findAll({
		rule: {
			any: [{ kind: "shorthand_property_identifier_pattern" }, { kind: "pair_pattern" }],
		},
	});

	if (!props || props.length === 0) return {};

	let hasFips = false;
	let hasGetFips = false;
	let hasSetFips = false;
	const keepTexts: string[] = [];

	for (const prop of props) {
		if (prop.kind() === "shorthand_property_identifier_pattern") {
			const name = prop.text().trim();
			if (name === "fips") {
				hasFips = true;
				continue;
			}
			if (name === "getFips") hasGetFips = true;
			if (name === "setFips") hasSetFips = true;
			keepTexts.push(name);
		} else {
			// pair_pattern: { fips: alias }
			const keyNode = prop.find({ rule: { kind: "property_identifier" } });
			const key = keyNode?.text();

			if (key === "fips") {
				hasFips = true;
				continue;
			}
			if (key === "getFips") hasGetFips = true;
			if (key === "setFips") hasSetFips = true;
			keepTexts.push(prop.text().trim());
		}
	}

	if (!hasFips) return {};

	// Add getFips and setFips if not already present
	if (!hasGetFips) keepTexts.push("getFips");
	if (!hasSetFips) keepTexts.push("setFips");

	// If all we had was fips and we're replacing it, we still have getFips and setFips
	return { edit: objPattern.replace(`{ ${keepTexts.join(", ")} }`) };
}

/**
 * Update import specifiers: import { fips } from "crypto"
 */
function updateImportSpecifiers(node: SgNode<Js>): { edit?: Edit; lineToRemove?: Range } {
	const importClause =
		node.kind() === "import_clause" ? node : node.find({ rule: { kind: "import_clause" } });

	if (!importClause) return {};

	const namedImports = importClause.find({ rule: { kind: "named_imports" } });
	if (!namedImports) return {};

	const specifiers = namedImports.findAll({
		rule: { kind: "import_specifier" },
	});

	if (!specifiers || specifiers.length === 0) return {};

	let hasFips = false;
	let hasGetFips = false;
	let hasSetFips = false;
	const keepTexts: string[] = [];

	for (const spec of specifiers) {
		// Check if this is the 'fips' import (with or without alias)
		// For import specifiers, the 'name' field contains the imported name
		const nameNode = spec.find({
			rule: {
				has: {
					field: "name",
					kind: "identifier",
				},
			},
		});

		const actualName = nameNode?.find({
			rule: { kind: "identifier" },
		});

		const importedName = actualName?.text();

		if (importedName === "fips") {
			hasFips = true;
			continue;
		}
		if (importedName === "getFips") hasGetFips = true;
		if (importedName === "setFips") hasSetFips = true;
		keepTexts.push(spec.text());
	}

	if (!hasFips) return {};

	// Add getFips and setFips if not already present
	if (!hasGetFips) keepTexts.push("getFips");
	if (!hasSetFips) keepTexts.push("setFips");

	return { edit: namedImports.replace(`{ ${keepTexts.join(", ")} }`) };
}

/**
 * Escape regexp special characters
 */
function escapeRegExp(input: string): string {
	return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

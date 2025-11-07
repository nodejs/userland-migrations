import type { Edit, SgRoot, SgNode } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";
import {
	getNodeImportStatements,
	getNodeImportCalls,
} from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";
import { updateBinding } from "@nodejs/codemod-utils/ast-grep/update-binding";

type StatementType = "import-dynamic" | "import-static" | "require";

const nodeGetterMap = {
	"import-dynamic": getNodeImportCalls,
	require: getNodeRequireCalls,
} as const;

/**
 * Main entry point that orchestrates all SlowBuffer → Buffer transformations
 * @param root - The AST root node to transform
 * @returns The transformed code as a string, or null if no changes were made
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit<JS>[] = [];

	// Process transformations in order:
	// 1. CommonJS require statements
	processStatements(root, edits, "require");
	// 2. ESM import statements
	processStatements(root, edits, "import-static");
	// 3. Dynamic import statements
	processStatements(root, edits, "import-dynamic");
	// 4. Usage patterns (constructor/function calls)
	processSlowBufferUsage(rootNode, edits);

	if (!edits.length) return null;
	return rootNode.commitEdits(edits);
}

/**
 * Unified function to process different types of import/require statements
 * @param root - The AST root to search for statements
 * @param edits - Array to collect edit operations
 * @param type - The type of statement to process
 */
function processStatements(root: SgRoot<JS>, edits: Edit<JS>[], type: StatementType): void {
	if (type === "import-static") {
		processESMImports(root, edits);
		return;
	}

	const statements = nodeGetterMap[type](root, "buffer");

	for (const statement of statements) {
		const nameField = statement.field("name");
		if (!nameField) continue;

		if (nameField.kind() === "identifier") {
			processIdentifierPattern(statement, nameField, edits, type);
		} else if (nameField.kind() === "object_pattern") {
			processObjectPattern(statement, nameField, edits);
		}
	}
}

/**
 * Handle ESM import statements
 */
function processESMImports(root: SgRoot<JS>, edits: Edit<JS>[]): void {
	const importStatements = getNodeImportStatements(root, "buffer");

	for (const statement of importStatements) {
		const allSpecifiers = statement.findAll({ rule: { kind: "import_specifier" } });

		const hasBuffer = allSpecifiers.some((spec) => spec.child(0)?.text() === "Buffer");
		const slowBufferSpecs = allSpecifiers.filter((spec) => spec.child(0)?.text() === "SlowBuffer");

		for (const spec of slowBufferSpecs) {
			const imported = spec.child(0);
			const alias = spec.child(2); // "as alias" part

			if (alias) {
				// SlowBuffer as SomeAlias -> Buffer as SomeAlias
				edits.push(imported.replace("Buffer"));
			} else if (hasBuffer) {
				// Remove SlowBuffer when Buffer already exists
				applyUpdateBinding(statement, edits, { old: "SlowBuffer" });
			} else {
				// SlowBuffer -> Buffer
				applyUpdateBinding(statement, edits, { old: "SlowBuffer", new: "Buffer" });
			}
		}
	}
}

/**
 * Handle identifier patterns like: const SlowBuffer = require('buffer')
 */
function processIdentifierPattern(
	statement: SgNode<JS>,
	nameField: SgNode<JS>,
	edits: Edit<JS>[],
	type: StatementType,
): void {
	if (nameField.text() !== "SlowBuffer") return;

	if (type === "require") {
		// Handle: const SlowBuffer = require('buffer').SlowBuffer
		const valueField = statement.field("value");
		if (valueField?.kind() === "member_expression") {
			const property = valueField.field("property");
			if (property?.text() === "SlowBuffer") {
				edits.push(nameField.replace("Buffer"));
				edits.push(property.replace("Buffer"));
				return;
			}
		}
	}

	// Handle: const SlowBuffer = await import('buffer')
	edits.push(nameField.replace("Buffer"));
}

/**
 * Handle object destructuring patterns
 */
function processObjectPattern(
	statement: SgNode<JS>,
	nameField: SgNode<JS>,
	edits: Edit<JS>[],
): void {
	// Check for aliased patterns: { SlowBuffer: alias }
	const aliasedPatterns = nameField.findAll({
		rule: {
			kind: "pair_pattern",
			has: {
				field: "key",
				kind: "property_identifier",
				regex: "^SlowBuffer$",
			},
		},
	});

	if (aliasedPatterns.length > 0) {
		// Just replace the key: { SlowBuffer: SB } -> { Buffer: SB }
		for (const pattern of aliasedPatterns) {
			const key = pattern.field("key");
			if (key?.text() === "SlowBuffer") {
				edits.push(key.replace("Buffer"));
			}
		}
		return;
	}

	// Check for shorthand patterns: { SlowBuffer }
	const hasSlowBufferShorthand = nameField
		.findAll({ rule: { kind: "shorthand_property_identifier_pattern" } })
		.some((n) => n.text() === "SlowBuffer");

	if (!hasSlowBufferShorthand) return;

	const hasBufferShorthand = nameField
		.findAll({ rule: { kind: "shorthand_property_identifier_pattern" } })
		.some((n) => n.text() === "Buffer");

	const parentDeclaration = findParentDeclaration(statement);
	if (!parentDeclaration) return;

	if (hasBufferShorthand) {
		// Remove SlowBuffer when Buffer exists
		applyUpdateBinding(parentDeclaration, edits, { old: "SlowBuffer" });
	} else {
		// Replace SlowBuffer with Buffer
		applyUpdateBinding(parentDeclaration, edits, { old: "SlowBuffer", new: "Buffer" });
	}
}

/**
 * Apply updateBinding result to edits array
 */
function applyUpdateBinding(
	node: SgNode<JS>,
	edits: Edit<JS>[],
	options: { old?: string; new?: string },
): void {
	const result = updateBinding(node, options);
	if (result?.edit) {
		edits.push(result.edit);
	} else if (result?.lineToRemove) {
		edits.push(node.replace(""));
	}
}

/**
 * Find the parent lexical_declaration node for updateBinding
 */
function findParentDeclaration(node: SgNode<JS>): SgNode<JS> | null {
	let current = node;
	while (current) {
		const kind = current.kind();
		if (kind === "lexical_declaration" || kind === "variable_declaration") {
			return current;
		}
		current = current.parent();
		if (!current) break;
	}
	return null;
}

/**
 * Extract arguments from a call expression
 */
function extractArgs(match: SgNode<JS>): string {
	try {
		const argsMatches = match.getMultipleMatches("ARGS");
		if (argsMatches.length > 0) {
			return argsMatches.map((a) => a.text()).join(", ");
		}
	} catch {
		// Fall through to field-based extraction
	}

	const argsField = match.field("arguments");
	if (argsField) {
		const text = argsField.text();
		return text.slice(1, -1); // Remove parentheses
	}

	return "";
}

/**
 * Transform SlowBuffer usage to Buffer.allocUnsafeSlow
 */
function transformSlowBufferCall(match: SgNode<JS>, binding: string, edits: Edit<JS>[]): void {
	const args = extractArgs(match);
	const replacement =
		binding === "SlowBuffer"
			? `Buffer.allocUnsafeSlow(${args})`
			: `${binding}.allocUnsafeSlow(${args})`;

	edits.push(match.replace(replacement));
}

/**
 * Process SlowBuffer constructor and function calls
 */
function processSlowBufferUsage(rootNode: SgNode<JS>, edits: Edit<JS>[]): void {
	const root = rootNode.getRoot();
	const allStatements = [
		...getNodeImportStatements(root, "buffer"),
		...getNodeRequireCalls(root, "buffer"),
		...getNodeImportCalls(root, "buffer"),
	];

	// Process bound SlowBuffer calls (from imports/requires)
	for (const importNode of allStatements) {
		try {
			const binding = resolveBindingPath(importNode, "$.SlowBuffer");
			if (!binding) continue;

			const slowBufferCalls = rootNode.findAll({
				rule: {
					any: [
						{ kind: "new_expression", pattern: `new ${binding}($$$ARGS)` },
						{ kind: "call_expression", pattern: `${binding}($$$ARGS)` },
					],
				},
			});

			for (const match of slowBufferCalls) {
				transformSlowBufferCall(match, binding, edits);
			}
		} catch {
			// Skip if binding resolution fails
		}
	}

	// Process direct SlowBuffer calls (unbound)
	const directCalls = rootNode.findAll({
		rule: {
			any: [
				{ kind: "new_expression", pattern: "new SlowBuffer($$$ARGS)" },
				{ kind: "call_expression", pattern: "SlowBuffer($$$ARGS)" },
			],
		},
	});

	for (const match of directCalls) {
		transformSlowBufferCall(match, "SlowBuffer", edits);
	}
}

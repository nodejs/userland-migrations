import type { Edit, SgRoot, SgNode } from "@codemod.com/jssg-types/main";
import {
	getNodeImportStatements,
	getNodeImportCalls,
} from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";

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
export default function transform(root: SgRoot): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

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
function processStatements(root: SgRoot, edits: Edit[], type: StatementType): void {
	if (type === "import-static") {
		// ESM imports have a different structure - handle them separately
		for (const imp of root.root().findAll({ rule: { kind: "import_clause" } })) {
			const specifiers = imp.findAll({ rule: { kind: "import_specifier" } });

			// Collect all imported names (not aliases) to check for conflicts
			const importedNames = new Set<string>();
			for (const spec of specifiers) {
				const imported = spec.child(0); // imported name
				if (imported) {
					importedNames.add(imported.text());
				}
			}

			for (const spec of specifiers) {
				const imported = spec.child(0); // imported name
				if (!imported) continue;

				if (imported.text() === "SlowBuffer") {
					// Check if this specifier has an alias
					const alias = spec.child(2); // "as alias" part

					if (alias) {
						// Has alias: SlowBuffer as SomeAlias -> Buffer as SomeAlias
						edits.push(imported.replace("Buffer"));
					} else if (importedNames.has("Buffer")) {
						// No alias but Buffer already imported: remove SlowBuffer entirely using AST
						removeSlowBufferFromImport(imp, edits);
					} else {
						// No alias and no Buffer conflict: SlowBuffer -> Buffer
						edits.push(imported.replace("Buffer"));
					}
				}
			}
		}
		return;
	}

	const statements = nodeGetterMap[type](root, "buffer");

	for (const statement of statements) {
		const nameField = statement.field("name");
		if (!nameField) continue;

		// Handle different name field patterns
		switch (nameField.kind()) {
			case "identifier":
				if (nameField.text() === "SlowBuffer") {
					if (type === "require") {
						// Handle direct assignment: const SlowBuffer = require('buffer').SlowBuffer
						const valueField = statement.field("value");
						if (valueField && valueField.kind() === "member_expression") {
							const property = valueField.field("property");
							if (property && property.text() === "SlowBuffer") {
								// Transform both the variable name and the property access
								edits.push(nameField.replace("Buffer"));
								edits.push(property.replace("Buffer"));
							}
						}
					} else {
						// Handle dynamic import: const SlowBuffer = await import('buffer')
						edits.push(nameField.replace("Buffer"));
					}
				}
				break;
			case "object_pattern":
				// Handle destructuring: const { SlowBuffer, ... } = require('buffer') or import('buffer')
				transformObjectPattern(nameField, edits);
				break;
		}
	}
}

/**
 * Transforms object destructuring patterns containing SlowBuffer references
 * Handles complex cases like:
 * - { SlowBuffer } → { Buffer }
 * - { SlowBuffer, Buffer } → { Buffer } (removes duplicate)
 * - { SlowBuffer: alias } → { Buffer: alias }
 * - { SlowBuffer as alias } → { Buffer as alias } (ESM)
 * @param patternNode - AST node representing the destructuring pattern
 * @param edits - Array to collect edit operations
 */
function transformObjectPattern(patternNode: SgNode, edits: Edit[]): void {
	// Collect existing identifiers to detect conflicts
	const identifiers = patternNode
		.findAll({
			rule: { kind: "shorthand_property_identifier_pattern" },
		})
		.map((n) => n.text());

	// Handle shorthand SlowBuffer references: { SlowBuffer }
	for (const node of patternNode.findAll({
		rule: { kind: "shorthand_property_identifier_pattern", regex: "^SlowBuffer$" },
	})) {
		if (identifiers.includes("Buffer")) {
			// Buffer already exists, remove SlowBuffer using pure AST manipulation
			removeSlowBufferFromObjectPattern(patternNode, edits);
		} else {
			// No conflict, just replace SlowBuffer with Buffer
			edits.push(node.replace("Buffer"));
		}
	}

	// Handle aliased patterns: { SlowBuffer: alias } or { SlowBuffer as alias }
	for (const node of patternNode.findAll({
		rule: { kind: "property_identifier", regex: "^SlowBuffer$" },
	})) {
		// Replace the property key SlowBuffer with Buffer
		edits.push(node.replace("Buffer"));
	}

	// Handle ESM-style aliased patterns: { SlowBuffer as alias }
	// These are handled as import_specifier in ESM contexts, but we check here too for completeness
	for (const node of patternNode.findAll({
		rule: {
			kind: "import_specifier",
			has: {
				field: "name",
				kind: "identifier",
				regex: "^SlowBuffer$",
			},
		},
	})) {
		const nameField = node.field("name");
		if (nameField) {
			edits.push(nameField.replace("Buffer"));
		}
	}
}

/**
 * Helper function to remove SlowBuffer from import statements using AST manipulation
 * @param importClause - The import_clause node containing the SlowBuffer specifier
 * @param edits - Array to collect edit operations
 */
function removeSlowBufferFromImport(importClause: SgNode, edits: Edit[]): void {
	// Find all import specifiers
	const allSpecifiers = importClause.findAll({ rule: { kind: "import_specifier" } });

	// Filter out SlowBuffer specifiers
	const remainingSpecifiers = allSpecifiers.filter((spec) => {
		const imported = spec.child(0);
		return imported && imported.text() !== "SlowBuffer";
	});

	if (remainingSpecifiers.length === 0) {
		// No remaining specifiers, this would result in empty import
		// Should not happen in practice since we check for Buffer conflict
		return;
	}

	// Reconstruct the named imports with remaining specifiers
	const namedImports = importClause.find({ rule: { kind: "named_imports" } });
	if (namedImports) {
		const newSpecifiersText = remainingSpecifiers.map((spec) => spec.text()).join(", ");
		edits.push(namedImports.replace(`{ ${newSpecifiersText} }`));
	}
}

/**
 * Helper function to remove SlowBuffer from object patterns using pure AST manipulation
 * Handles patterns like { SlowBuffer, Buffer, other } → { Buffer, other }
 * @param patternNode - The object_pattern node containing SlowBuffer
 * @param edits - Array to collect edit operations
 */
function removeSlowBufferFromObjectPattern(patternNode: SgNode, edits: Edit[]): void {
	// Find all shorthand property identifiers in the pattern
	const allProperties = patternNode.findAll({
		rule: { kind: "shorthand_property_identifier_pattern" },
	});

	// Filter out SlowBuffer properties
	const remainingProperties = allProperties.filter((prop) => prop.text() !== "SlowBuffer");

	// Also collect any other pattern types (like pair_pattern for aliases)
	const otherPatterns = patternNode.findAll({
		rule: { kind: "pair_pattern" },
	});

	// Combine all remaining elements
	const allRemainingElements = [...remainingProperties, ...otherPatterns];

	if (allRemainingElements.length === 0) {
		// This would result in empty pattern {}, which shouldn't happen
		// since we know Buffer exists
		return;
	}

	// Reconstruct the object pattern with remaining elements
	const newPatternText = allRemainingElements.map((elem) => elem.text()).join(", ");
	edits.push(patternNode.replace(`{ ${newPatternText} }`));
}

/**
 * Transforms actual SlowBuffer usage (constructor calls and function calls)
 * Uses resolveBindingPath to determine how SlowBuffer was imported, then transforms:
 * - new SlowBuffer(100) → Buffer.allocUnsafeSlow(100)
 * - new alias(100) → alias.allocUnsafeSlow(100) (when SlowBuffer imported as alias)
 * - SlowBuffer(100) → Buffer.allocUnsafeSlow(100)
 * @param rootNode - The AST root node to search for usage patterns
 * @param edits - Array to collect edit operations
 */
function processSlowBufferUsage(rootNode: SgNode, edits: Edit[]): void {
	const root = rootNode.getRoot();
	const importStatements = getNodeImportStatements(root, "buffer");
	const requireStatements = getNodeRequireCalls(root, "buffer");
	const dynamicImportStatements = getNodeImportCalls(root, "buffer");

	for (const importNode of [
		...importStatements,
		...requireStatements,
		...dynamicImportStatements,
	]) {
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
				try {
					const argsMatches = match.getMultipleMatches("ARGS");
					const argsField = match.field("arguments");
					const originalArgsText = argsField ? argsField.text().slice(1, -1) : "";
					const argsText =
						argsMatches.length > 0 ? argsMatches.map((a) => a.text()).join(", ") : originalArgsText;

					const replacement =
						binding === "SlowBuffer"
							? `Buffer.allocUnsafeSlow(${argsText})`
							: `${binding}.allocUnsafeSlow(${argsText})`;

					edits.push(match.replace(replacement));
				} catch {
					const args = match.field("arguments");
					if (args) {
						const argsText = args.text().slice(1, -1);
						const replacement =
							binding === "SlowBuffer"
								? `Buffer.allocUnsafeSlow(${argsText})`
								: `${binding}.allocUnsafeSlow(${argsText})`;
						edits.push(match.replace(replacement));
					}
				}
			}
		} catch {
			continue;
		}
	}

	const directSlowBufferCalls = rootNode.findAll({
		rule: {
			any: [
				{ kind: "new_expression", pattern: "new SlowBuffer($$$ARGS)" },
				{ kind: "call_expression", pattern: "SlowBuffer($$$ARGS)" },
			],
		},
	});

	for (const match of directSlowBufferCalls) {
		try {
			const argsMatches = match.getMultipleMatches("ARGS");
			const argsField = match.field("arguments");
			const originalArgsText = argsField ? argsField.text().slice(1, -1) : "";
			const argsText =
				argsMatches.length > 0 ? argsMatches.map((a) => a.text()).join(", ") : originalArgsText;

			edits.push(match.replace(`Buffer.allocUnsafeSlow(${argsText})`));
		} catch {
			const args = match.field("arguments");
			if (args) {
				const argsText = args.text().slice(1, -1);
				edits.push(match.replace(`Buffer.allocUnsafeSlow(${argsText})`));
			}
		}
	}
}

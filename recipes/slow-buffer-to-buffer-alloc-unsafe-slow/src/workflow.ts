import type { Edit, SgRoot, SgNode } from "@codemod.com/jssg-types/main";
import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";

export default function transform(root: SgRoot): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	// Process require statements for 'buffer' module
	processRequireStatements(root, edits);

	// Process ESM import statements for 'buffer' module
	processImportStatements(root, edits);

	// Process SlowBuffer usage patterns (constructor calls, direct calls)
	processSlowBufferUsage(rootNode, edits);

	// Process comments mentioning SlowBuffer
	processSlowBufferComments(rootNode, edits);

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

/**
 * Process require statements for the 'buffer' module and transform SlowBuffer references
 */
function processRequireStatements(root: SgRoot, edits: Edit[]): boolean {
	let hasChanges = false;
	const requireStatements = getNodeRequireCalls(root, "buffer");

	for (const statement of requireStatements) {
		// Get the name field to check what type of pattern we're dealing with
		const nameField = statement.field("name");
		if (!nameField) continue;

		// Handle direct variable assignment: const SlowBuffer = require('buffer').SlowBuffer
		if (nameField.kind() === "identifier" && nameField.text() === "SlowBuffer") {
			const valueField = statement.field("value");
			if (valueField && valueField.kind() === "member_expression") {
				const property = valueField.field("property");
				if (property && property.text() === "SlowBuffer") {
					// Replace the identifier name
					edits.push(nameField.replace("Buffer"));
					// Replace the property in the member expression
					edits.push(property.replace("Buffer"));
					hasChanges = true;
				}
			}
		}

		// Handle destructuring patterns: const { SlowBuffer, ... } = require('buffer')
		if (nameField.kind() === "object_pattern") {
			const originalText = nameField.text();
			if (originalText.includes("SlowBuffer")) {
				let newText = transformDestructuringPattern(originalText);
				if (newText !== originalText) {
					edits.push(nameField.replace(newText));
					hasChanges = true;
				}
			}
		}
	}

	return hasChanges;
}

/**
 * Process ESM import statements for the 'buffer' module and transform SlowBuffer references
 */
function processImportStatements(root: SgRoot, edits: Edit[]): boolean {
	let hasChanges = false;
	const importStatements = getNodeImportStatements(root, "buffer");

	for (const statement of importStatements) {
		// Try to find named_imports directly in the statement
		const namedImports = statement.find({ rule: { kind: "named_imports" } });
		if (namedImports) {
			const originalText = namedImports.text();
			if (originalText.includes("SlowBuffer")) {
				let newText = transformDestructuringPattern(originalText);
				if (newText !== originalText) {
					edits.push(namedImports.replace(newText));
					hasChanges = true;
				}
			}
		}
	}

	return hasChanges;
}

/**
 * Transform destructuring patterns by replacing SlowBuffer with Buffer
 * Handles cases like { SlowBuffer }, { Buffer, SlowBuffer }, { SlowBuffer, Buffer }, etc.
 * Also handles aliased patterns like { SlowBuffer: SB }, { SlowBuffer: SB, Buffer }
 * For ESM imports: { SlowBuffer as SB } -> { Buffer as SB }
 * Preserves original formatting as much as possible
 */
function transformDestructuringPattern(originalText: string): string {
	// For simple case { SlowBuffer }, replace with { Buffer } preserving whitespace
	if (
		originalText.includes("SlowBuffer") &&
		!originalText.includes(",") &&
		!originalText.includes(":") &&
		!originalText.includes(" as ")
	) {
		return originalText.replace(/SlowBuffer/g, "Buffer");
	}

	let newText = originalText;

	// Handle aliased patterns (both CommonJS : and ESM as syntax)
	// { SlowBuffer: SB } -> { Buffer: SB }
	newText = newText.replace(/SlowBuffer(\s*:\s*\w+)/g, "Buffer$1");
	// { SlowBuffer as SB } -> { Buffer as SB }
	newText = newText.replace(/SlowBuffer(\s+as\s+\w+)/g, "Buffer$1");

	// If Buffer is already present in this specific pattern, just remove SlowBuffer
	if (originalText.includes("Buffer") && originalText.includes("SlowBuffer")) {
		// Remove non-aliased SlowBuffer references very carefully to preserve spacing
		newText = newText
			.replace(/,\s*SlowBuffer(?!\s*[:as])/g, "") // Remove SlowBuffer with leading comma
			.replace(/SlowBuffer\s*,\s*/g, "") // Remove SlowBuffer with trailing comma and space
			.replace(/SlowBuffer(?!\s*[:as])/g, ""); // Remove standalone SlowBuffer (not followed by : or as)

		// Clean up any double spaces after opening brace
		newText = newText.replace(/{\s{2,}/g, "{ ");
		// Clean up any double commas but preserve spacing
		newText = newText.replace(/,\s*,/g, ",");
	}
	// If Buffer is not present, replace first SlowBuffer with Buffer, remove others
	else if (originalText.includes("SlowBuffer")) {
		// Replace the first non-aliased SlowBuffer with Buffer
		newText = newText.replace(/SlowBuffer(?!\s*[:as])/, "Buffer");
		// Remove any remaining non-aliased SlowBuffer references
		newText = newText
			.replace(/,\s*SlowBuffer\s*(?![\s:as])/g, "")
			.replace(/SlowBuffer\s*,\s*/g, "")
			.replace(/SlowBuffer\s*(?![\s:as])/g, "");
		// Clean up commas
		newText = newText.replace(/,\s*,/g, ",");
	}

	return newText;
}

/**
 * Process SlowBuffer usage patterns (constructor calls and direct function calls)
 */
function processSlowBufferUsage(rootNode: SgNode, edits: Edit[]): boolean {
	let hasChanges = false;

	// Collect all SlowBuffer aliases from destructuring patterns and imports
	const slowBufferAliases = new Set<string>();

	// Find all object patterns that include SlowBuffer aliases (CommonJS require)
	const objectPatterns = rootNode.findAll({ rule: { kind: "object_pattern" } });
	for (const pattern of objectPatterns) {
		const text = pattern.text();
		// Match patterns like { SlowBuffer: SB } to extract alias "SB"
		const aliasMatches = text.matchAll(/SlowBuffer\s*:\s*(\w+)/g);
		for (const match of aliasMatches) {
			slowBufferAliases.add(match[1]);
		}
	}

	// Find all named_imports that include SlowBuffer aliases (ESM imports)
	const namedImports = rootNode.findAll({ rule: { kind: "named_imports" } });
	for (const importNode of namedImports) {
		const text = importNode.text();
		// Match patterns like { SlowBuffer as SB } to extract alias "SB"
		const aliasMatches = text.matchAll(/SlowBuffer\s+as\s+(\w+)/g);
		for (const match of aliasMatches) {
			slowBufferAliases.add(match[1]);
		}
	}

	// Handle constructor patterns: new SlowBuffer(size) and new SB(size) for aliases
	const constructorCalls = rootNode.findAll({
		rule: {
			kind: "new_expression",
			has: {
				field: "constructor",
				kind: "identifier",
				regex: "^SlowBuffer$",
			},
		},
	});

	for (const constructorCall of constructorCalls) {
		const args = constructorCall.field("arguments");
		if (args) {
			// Extract the arguments text (without parentheses)
			const argsText = args.text().slice(1, -1); // Remove ( and )
			edits.push(constructorCall.replace(`Buffer.allocUnsafeSlow(${argsText})`));
			hasChanges = true;
		}
	}

	// Handle constructor calls with aliases
	for (const alias of slowBufferAliases) {
		const aliasConstructorCalls = rootNode.findAll({
			rule: {
				kind: "new_expression",
				has: {
					field: "constructor",
					kind: "identifier",
					regex: `^${alias}$`,
				},
			},
		});

		for (const constructorCall of aliasConstructorCalls) {
			const args = constructorCall.field("arguments");
			if (args) {
				const argsText = args.text().slice(1, -1);
				edits.push(constructorCall.replace(`${alias}.allocUnsafeSlow(${argsText})`));
				hasChanges = true;
			}
		}
	}

	// Handle direct function calls: SlowBuffer(size)
	const directCalls = rootNode.findAll({
		rule: {
			kind: "call_expression",
			has: {
				field: "function",
				kind: "identifier",
				regex: "^SlowBuffer$",
			},
		},
	});

	for (const directCall of directCalls) {
		const args = directCall.field("arguments");
		if (args) {
			// Extract the arguments text (without parentheses)
			const argsText = args.text().slice(1, -1); // Remove ( and )
			edits.push(directCall.replace(`Buffer.allocUnsafeSlow(${argsText})`));
			hasChanges = true;
		}
	}

	// Handle direct function calls with aliases
	for (const alias of slowBufferAliases) {
		const aliasDirectCalls = rootNode.findAll({
			rule: {
				kind: "call_expression",
				has: {
					field: "function",
					kind: "identifier",
					regex: `^${alias}$`,
				},
			},
		});

		for (const directCall of aliasDirectCalls) {
			const args = directCall.field("arguments");
			if (args) {
				const argsText = args.text().slice(1, -1);
				edits.push(directCall.replace(`${alias}.allocUnsafeSlow(${argsText})`));
				hasChanges = true;
			}
		}
	}

	return hasChanges;
}

/**
 * Process comments mentioning SlowBuffer and update them
 */
function processSlowBufferComments(rootNode: SgNode, edits: Edit[]): boolean {
	let hasChanges = false;

	// Handle specific comment patterns
	const comments = rootNode.findAll({
		rule: {
			kind: "comment",
			regex: ".*SlowBuffer.*",
		},
	});

	for (const comment of comments) {
		const originalText = comment.text();
		if (originalText.includes("Using SlowBuffer constructor")) {
			edits.push(comment.replace("// Using Buffer.allocUnsafeSlow()"));
			hasChanges = true;
		}
	}

	return hasChanges;
}

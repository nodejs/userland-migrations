import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";
import type { SgRoot, Edit, SgNode } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";

/**
 * Transform function that validates and converts invalid argument types to fs.existsSync().
 * This is useful to migrate code that passes invalid argument types which now causes
 * deprecation warnings or errors (DEP0187).
 *
 * Handles:
 * 1. Direct literal values (numbers, objects) → wrap with String()
 * 2. null values → convert to String(null || '')
 * 3. Variables/parameters → add type check before the call
 * 4. String, Buffer, or URL arguments → leave as is (already valid)
 *
 * Works with both CommonJS (require) and ESM (import) syntax.
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	// Collect all fs import/require statements
	const allStatementNodes = [
		...getNodeImportStatements(root, "fs"),
		...getNodeRequireCalls(root, "fs"),
	];

	// If any import found don't process the file
	if (!allStatementNodes.length) return null;

	for (const statementNode of allStatementNodes) {
		// Try to resolve the binding path for fs.existsSync
		const bindingPath = resolveBindingPath(statementNode, "fs.existsSync");

		if (!bindingPath) continue;

		// Find all calls to fs.existsSync
		const callNodes = rootNode.findAll({
			rule: {
				pattern: `${bindingPath}($ARG)`,
			},
		});

		for (const callNode of callNodes) {
			const argNode = callNode.getMatch("ARG");
			if (!argNode) continue;

			const argText = argNode.text();
			const argKind = argNode.kind();

			// Skip if already valid types or wrapped in String/Buffer/URL constructor
			if (isAlreadyValid(argText, argKind)) {
				continue;
			}

			// Handle different argument types
			if (argKind === "null") {
				// Case: fs.existsSync(null) → fs.existsSync(String(null || ''))
				edits.push(argNode.replace(`String(${argText} || '')`));
			} else if (argKind === "identifier") {
				// Case: fs.existsSync(path) → add type check before the call
				const edit = addTypeCheckForVariable(callNode, argText);
				if (edit) {
					edits.push(edit);
				}
			} else if (isLiteralOrExpression(argKind)) {
				// Case: fs.existsSync(123) or fs.existsSync({ path: '/file' })
				// → fs.existsSync(String(123)) or fs.existsSync(String({ path: '/file' }))
				edits.push(argNode.replace(`String(${argText})`));
			}
		}
	}

	// Also handle destructured import/require: const { existsSync } = require('fs')
	for (const statementNode of allStatementNodes) {
		const bindingPath = resolveBindingPath(statementNode, "existsSync");

		if (!bindingPath) continue;

		// Find all calls to existsSync (destructured)
		const callNodes = rootNode.findAll({
			rule: {
				pattern: `${bindingPath}($ARG)`,
			},
		});

		for (const callNode of callNodes) {
			const argNode = callNode.getMatch("ARG");
			if (!argNode) continue;

			const argText = argNode.text();
			const argKind = argNode.kind();

			// Skip if already valid types or wrapped
			if (isAlreadyValid(argText, argKind)) {
				continue;
			}

			// Handle different argument types
			if (argKind === "null") {
				edits.push(argNode.replace(`String(${argText} || '')`));
			} else if (argKind === "identifier") {
				const edit = addTypeCheckForVariable(callNode, argText);
				if (edit) {
					edits.push(edit);
				}
			} else if (isLiteralOrExpression(argKind)) {
				edits.push(argNode.replace(`String(${argText})`));
			}
		}
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

/**
 * Check if the argument is already a valid type (string, Buffer, URL)
 * or already wrapped in String/Buffer/URL constructor
 */
function isAlreadyValid(argText: string, argKind: string): boolean {
	// Check if it's a string literal
	if (argKind === "string" || argKind === "template_string") {
		return true;
	}

	// Check if already wrapped with String(), Buffer.from(), or new URL()
	if (
		argText.startsWith("String(") ||
		argText.startsWith("Buffer.") ||
		argText.startsWith("new Buffer(") ||
		argText.startsWith("new URL(") ||
		argText.includes("Buffer.isBuffer(") ||
		argText.includes("instanceof URL")
	) {
		return true;
	}

	return false;
}

/**
 * Check if the argument kind is a literal or expression that should be wrapped
 */
function isLiteralOrExpression(argKind: string): boolean {
	return [
		"number",
		"object",
		"array",
		"true",
		"false",
		"undefined",
		"binary_expression",
		"unary_expression",
		"call_expression",
	].includes(argKind);
}

/**
 * Add type check for variable arguments
 * Wraps the fs.existsSync() call with a type check
 */
function addTypeCheckForVariable(callNode: SgNode<JS>, varName: string): Edit | null {
	// Find the statement containing the call
	let statementNode = callNode.parent();

	while (statementNode && !isStatement(statementNode.kind())) {
		statementNode = statementNode.parent();
	}

	if (!statementNode) return null;

	const statementText = statementNode.text();

	// Add type check before the statement
	const typeCheck = `if (typeof ${varName} !== 'string' && !Buffer.isBuffer(${varName}) && !(${varName} instanceof URL)) {\n    ${varName} = String(${varName});\n  }\n  `;

	const newStatement = typeCheck + statementText;

	return statementNode.replace(newStatement);
}

/**
 * Check if a node kind represents a statement
 */
function isStatement(kind: string): boolean {
	return [
		"expression_statement",
		"return_statement",
		"variable_declaration",
		"if_statement",
		"for_statement",
		"while_statement",
		"do_statement",
		"switch_statement",
	].includes(kind);
}

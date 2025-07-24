import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import type { SgRoot, Edit } from "@ast-grep/napi";

/**
 * Transform function that converts deprecated util.is**() calls
 * to their modern equivalents.
 *
 * Handles:
 * 1. util.isArray() -> Array.isArray()
 * 2. util.isBoolean() -> typeof value === 'boolean'
 * 3. util.isBuffer() -> Buffer.isBuffer()
 * 4. util.isDate() -> value instanceof Date
 * 5. util.isError() -> value instanceof Error
 * 6. util.isFunction() -> typeof value === 'function'
 * 7. util.isNull() -> value === null
 * 8. util.isNullOrUndefined() -> value == null
 * 9. util.isNumber() -> typeof value === 'number'
 * 10. util.isObject() -> typeof value === 'object' && value !== null
 * 11. util.isPrimitive() -> value !== Object(value)
 * 12. util.isRegExp() -> value instanceof RegExp
 * 13. util.isString() -> typeof value === 'string'
 * 14. util.isSymbol() -> typeof value === 'symbol'
 * 15. util.isUndefined() -> typeof value === 'undefined'
 */
export default function transform(root: SgRoot): string | null {
	const rootNode = root.root();
	let hasChanges = false;
	const edits: Edit[] = [];

	// Mapping of util.is**() methods to their replacements
	const replacements = {
		'isArray': (arg: string) => `Array.isArray(${arg})`,
		'isBoolean': (arg: string) => `typeof ${arg} === 'boolean'`,
		'isBuffer': (arg: string) => `Buffer.isBuffer(${arg})`,
		'isDate': (arg: string) => `${arg} instanceof Date`,
		'isError': (arg: string) => `${arg} instanceof Error`,
		'isFunction': (arg: string) => `typeof ${arg} === 'function'`,
		'isNull': (arg: string) => `${arg} === null`,
		'isNullOrUndefined': (arg: string) => `${arg} == null`,
		'isNumber': (arg: string) => `typeof ${arg} === 'number'`,
		'isObject': (arg: string) => `typeof ${arg} === 'object' && ${arg} !== null`,
		'isPrimitive': (arg: string) => `${arg} !== Object(${arg})`,
		'isRegExp': (arg: string) => `${arg} instanceof RegExp`,
		'isString': (arg: string) => `typeof ${arg} === 'string'`,
		'isSymbol': (arg: string) => `typeof ${arg} === 'symbol'`,
		'isUndefined': (arg: string) => `typeof ${arg} === 'undefined'`
	};

	// Track which methods are actually used so we can clean up imports
	const usedMethods = new Set<string>();

	// Find all util.is**() calls
	for (const [method, replacement] of Object.entries(replacements)) {
		// Pattern for util.isMethod(arg)
		const utilCalls = rootNode.findAll({
			rule: {
				pattern: `util.${method}($ARG)`
			}
		});

		for (const call of utilCalls) {
			const arg = call.getMatch("ARG");
			if (!arg) continue;

			const argText = arg.text();
			const newCallText = replacement(argText);
			edits.push(call.replace(newCallText));
			hasChanges = true;
		}

		// Pattern for destructured calls like isArray(arg)
		const destructuredCalls = rootNode.findAll({
			rule: {
				pattern: `${method}($ARG)`
			}
		});

		for (const call of destructuredCalls) {
			// Check if this method is imported from util
			if (!isMethodImportedFromUtil(root, method)) continue;

			const arg = call.getMatch("ARG");
			if (!arg) continue;

			const argText = arg.text();
			const newCallText = replacement(argText);
			edits.push(call.replace(newCallText));
			hasChanges = true;
			usedMethods.add(method);
		}
	}

	// Clean up unused imports if any util.is**() methods have been replaced
	if (hasChanges) {
		cleanupUtilImports(root, edits, usedMethods);
	}

	if (!hasChanges) return null;

	return rootNode.commitEdits(edits);
}

/**
 * Check if a specific util.is**() method is imported from util
 */
function isMethodImportedFromUtil(root: SgRoot, methodName: string): boolean {
	const importStatements = getNodeImportStatements(root, 'util');
	const requireStatements = getNodeRequireCalls(root, 'util');

	// Check import statements
	for (const importNode of importStatements) {
		const importText = importNode.text();
		if (importText.includes(`${methodName}`)) {
			return true;
		}
	}

	// Check require statements
	for (const requireNode of requireStatements) {
		const requireText = requireNode.text();
		if (requireText.includes(`${methodName}`)) {
			return true;
		}
	}

	return false;
}

/**
 * Clean up util imports by removing unused is**() methods
 */
function cleanupUtilImports(root: SgRoot, edits: Edit[], usedMethods: Set<string>): void {
	// Clean up import statements
	const importStatements = getNodeImportStatements(root, 'util');
	for (const importNode of importStatements) {
		const importText = importNode.text();

		// Check if it's a named import (destructured)
		const namedImports = importNode.find({ rule: { kind: 'named_imports' } });
		if (namedImports) {
			// Check if we need to remove any methods
			const shouldRemove = Array.from(usedMethods).some(method => importText.includes(method));
			if (shouldRemove) {
				// Remove the entire import statement since all methods are being replaced
				edits.push(importNode.replace(''));
			}
		}
	}

	// Clean up require statements using the utility function
	const requireStatements = getNodeRequireCalls(root, 'util');
	for (const requireNode of requireStatements) {
		const requireText = requireNode.text();

		// Check if any of the used methods are in this require
		const shouldRemove = Array.from(usedMethods).some(method => requireText.includes(method));
		if (shouldRemove) {
			// Remove the entire require statement
			edits.push(requireNode.replace(''));
		}
	}
}

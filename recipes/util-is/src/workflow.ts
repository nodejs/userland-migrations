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

	// Track non util.is**() methods that are used
	const nonIsMethodsUsed = new Set<string>();

	// Check what util methods are currently being used (before any transformations)
	const currentUtilUsages = rootNode.findAll({
		rule: {
			pattern: 'util.$METHOD($$$)'
		}
	});

	// Find all util.is**() method usages and track non-is methods
	for (const usage of currentUtilUsages) {
		const methodMatch = usage.getMatch('METHOD');
		if (methodMatch) {
			const methodName = methodMatch.text();
			if (!(methodName in replacements)) {
				nonIsMethodsUsed.add(methodName);
			}
		}
	}

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
			usedMethods.add(method); // Track namespace method usage
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

	if (!hasChanges) return null;

	// Clean up unused imports if any util.is**() methods have been replaced
	cleanupUtilImports(root, edits, nonIsMethodsUsed);

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
 * and remove it entirely if no other methods are used.
 */
function cleanupUtilImports(root: SgRoot, edits: Edit[], nonIsMethodsUsed: Set<string>): void {
	const importStatements = getNodeImportStatements(root, 'util');
	const requireStatements = getNodeRequireCalls(root, 'util');

	// All util.is**() methods that could be imported
	const allIsMethods = [
		'isArray', 'isBoolean', 'isBuffer', 'isDate', 'isError', 'isFunction',
		'isNull', 'isNullOrUndefined', 'isNumber', 'isObject', 'isPrimitive',
		'isRegExp', 'isString', 'isSymbol', 'isUndefined'
	];

	// Process import statements
	for (const importNode of importStatements) {
		const importText = importNode.text();

		// Handle named imports: import { isArray, isBoolean, otherMethod } from 'util'
		const namedImportMatch = importText.match(/import\s*\{\s*([^}]+)\s*\}\s*from\s*['"`](node:)?util['"`]/);
		if (namedImportMatch) {
			const importedItems = namedImportMatch[1]
				.split(',')
				.map(item => item.trim())
				.filter(item => item.length > 0);

			// Filter out the is**() methods that were replaced
			const remainingImports = importedItems.filter(item => {
				return !allIsMethods.includes(item);
			});

			if (remainingImports.length === 0) {
				// Remove the entire import statement
				edits.push(importNode.replace(''));
			} else if (remainingImports.length < importedItems.length) {
				// Update the import to only include remaining methods
				const newImportText = importText.replace(
					namedImportMatch[1],
					remainingImports.join(', ')
				);
				edits.push(importNode.replace(newImportText));
			}
		}
		// Handle namespace imports: import util from 'util'
		else if (importText.match(/import\s+\w+\s+from\s*['"`](node:)?util['"`]/)) {
			// If no non-is**() methods are used, remove the entire import
			if (nonIsMethodsUsed.size === 0) {
				edits.push(importNode.replace(''));
			}
		}
	}

	// Process require statements
	for (const requireNode of requireStatements) {
		const requireText = requireNode.text();

		// Handle destructured requires: { isArray, isBoolean, otherMethod } = require('util')
		const destructuredMatch = requireText.match(/\{\s*([^}]+)\s*\}\s*=\s*require\s*\(\s*['"`](node:)?util['"`]\s*\)/);
		if (destructuredMatch) {
			const importedItems = destructuredMatch[1]
				.split(',')
				.map(item => item.trim())
				.filter(item => item.length > 0);

			// Filter out the is**() methods that were replaced
			const remainingImports = importedItems.filter(item => {
				return !allIsMethods.includes(item);
			});

			if (remainingImports.length === 0) {
				// Remove the entire require statement
				const parentNode = requireNode.parent();
				if (parentNode && (parentNode.kind() === 'variable_declaration' || parentNode.kind() === 'lexical_declaration')) {
					edits.push(parentNode.replace(''));
				} else {
					// Fallback: just remove the declarator
					edits.push(requireNode.replace(''));
				}
			} else if (remainingImports.length < importedItems.length) {
				// Update the require to only include remaining methods
				const newRequireText = requireText.replace(
					destructuredMatch[1],
					remainingImports.join(', ')
				);
				edits.push(requireNode.replace(newRequireText));
			}
		}
		// Handle namespace requires: util = require('util')
		else if (requireText.match(/\w+\s*=\s*require\s*\(\s*['"`](node:)?util['"`]\s*\)/)) {
			// If no non-is**() methods are used, remove the entire require
			if (nonIsMethodsUsed.size === 0) {
				// Find the parent variable_declaration node and remove it entirely
				const parentNode = requireNode.parent();
				if (parentNode && (parentNode.kind() === 'variable_declaration' || parentNode.kind() === 'lexical_declaration')) {
					edits.push(parentNode.replace(''));
				} else {
					// Fallback: just remove the declarator
					edits.push(requireNode.replace(''));
				}
			}
		}
	}
}

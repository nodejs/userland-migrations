import {
	getNodeImportStatements,
	getDefaultImportIdentifier
} from "@nodejs/codemod-utils/ast-grep/import-statement";
import {
	getNodeRequireCalls,
	getRequireDestructuredIdentifiers,
	getRequireNamespaceIdentifier
} from "@nodejs/codemod-utils/ast-grep/require-call";
import { removeLines } from "@nodejs/codemod-utils/ast-grep/remove-lines";
import type { SgRoot, Edit, Range } from "@ast-grep/napi";

/**
 * Transform function that converts deprecated util.is**() calls
 * to their modern equivalents.
 *
 * Handles:
 * 1. util.isArray() → Array.isArray()
 * 2. util.isBoolean() → typeof value === 'boolean'
 * 3. util.isBuffer() → Buffer.isBuffer()
 * 4. util.isDate() → value instanceof Date
 * 5. util.isError() → value instanceof Error
 * 6. util.isFunction() → typeof value === 'function'
 * 7. util.isNull() → value === null
 * 8. util.isNullOrUndefined() → value == null
 * 9. util.isNumber() → typeof value === 'number'
 * 10. util.isObject() → typeof value === 'object' && value !== null
 * 11. util.isPrimitive() → value !== Object(value)
 * 12. util.isRegExp() → value instanceof RegExp
 * 13. util.isString() → typeof value === 'string'
 * 14. util.isSymbol() → typeof value === 'symbol'
 * 15. util.isUndefined() → typeof value === 'undefined'
 */
export default function transform(root: SgRoot): string | null {
	const rootNode = root.root();
	let hasChanges = false;
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	// Mapping of util.is**() methods to their replacements
	const replacements = {
		'isArray': (arg: string) => `Array.isArray(${arg})`,
		'isBoolean': (arg: string) => `typeof ${arg} === 'boolean'`,
		'isBuffer': (arg: string) => `Buffer.isBuffer(${arg})`,
		'isDate': (arg: string) => `${arg} instanceof Date`,
		'isError': (arg: string) => `Error.isError(${arg})`,
		'isFunction': (arg: string) => `typeof ${arg} === 'function'`,
		'isNull': (arg: string) => `${arg} === null`,
		'isNullOrUndefined': (arg: string) => `${arg} == null`,
		'isNumber': (arg: string) => `typeof ${arg} === 'number'`,
		'isObject': (arg: string) => `${arg} && typeof ${arg} === 'object'`,
		'isPrimitive': (arg: string) => `Object(${arg}) !== ${arg}`,
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
	cleanupUtilImports(root, edits, nonIsMethodsUsed, linesToRemove);

	let sourceCode = rootNode.commitEdits(edits);
	sourceCode = removeLines(sourceCode, linesToRemove);
	return sourceCode;
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
		if (importText.includes(methodName)) return true;
	}

	// Check require statements
	for (const requireNode of requireStatements) {
		const requireText = requireNode.text();

		if (requireText.includes(methodName)) return true;
	}

	return false;
}

/**
 * Clean up util imports by removing unused is**() methods
 * and remove it entirely if no other methods are used.
 */
function cleanupUtilImports(root: SgRoot, edits: Edit[], nonIsMethodsUsed: Set<string>, linesToRemove: Range[]): void {
	// All util.is**() methods that could be imported
	const allIsMethods = new Set([
		'isArray', 'isBoolean', 'isBuffer', 'isDate', 'isError', 'isFunction',
		'isNull', 'isNullOrUndefined', 'isNumber', 'isObject', 'isPrimitive',
		'isRegExp', 'isString', 'isSymbol', 'isUndefined'
	]);

	// Helper function to filter out is**() methods
	const filterNonIsMethods = (identifiers: { text(): string }[]) =>
		identifiers.filter(id => !allIsMethods.has(id.text()));

	// Process import statements
	const importStatements = getNodeImportStatements(root, 'util');

	for (const importNode of importStatements) {
		const namedSpecifiers = importNode.findAll({ rule: { kind: "import_specifier" } });
		const defaultImport = getDefaultImportIdentifier(importNode);

		if (namedSpecifiers.length > 0) {
			const remainingSpecifiers = filterNonIsMethods(namedSpecifiers);

			if (remainingSpecifiers.length === 0) {
				linesToRemove.push(importNode.range());
			} else if (remainingSpecifiers.length < namedSpecifiers.length) {
				const namedImportsClause = importNode.find({ rule: { kind: "named_imports" } });

				if (namedImportsClause) {
					const newImportsText = remainingSpecifiers.map(s => s.text()).join(', ');

					edits.push(namedImportsClause.replace(`{ ${newImportsText} }`));
				}
			}
		} else if (defaultImport && nonIsMethodsUsed.size === 0) {
			linesToRemove.push(importNode.range());
		}
	}

	// Process require statements
	const requireStatements = getNodeRequireCalls(root, 'util');

	for (const requireNode of requireStatements) {
		const destructuredIdentifiers = getRequireDestructuredIdentifiers(requireNode);
		const namespaceIdentifier = getRequireNamespaceIdentifier(requireNode);

		if (destructuredIdentifiers.length > 0) {
			const remainingIdentifiers = filterNonIsMethods(destructuredIdentifiers);

			if (remainingIdentifiers.length === 0) {
				const parent = requireNode.parent();

				if (parent) {
					linesToRemove.push(parent.range());
				}
			} else if (remainingIdentifiers.length < destructuredIdentifiers.length) {
				const objectPattern = requireNode.find({ rule: { kind: "object_pattern" } });

				if (objectPattern) {
					const newImportsText = remainingIdentifiers.map(i => i.text()).join(', ');
					edits.push(objectPattern.replace(`{ ${newImportsText} }`));
				}
			}
		} else if (namespaceIdentifier && nonIsMethodsUsed.size === 0) {
			const parent = requireNode.parent();

			if (parent) {
				linesToRemove.push(parent.range());
			}
		}
	}
}

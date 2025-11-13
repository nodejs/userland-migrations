import {
	getNodeImportStatements,
	getDefaultImportIdentifier,
	getNodeImportCalls,
} from '@nodejs/codemod-utils/ast-grep/import-statement';
import {
	getNodeRequireCalls,
	getRequireNamespaceIdentifier,
} from '@nodejs/codemod-utils/ast-grep/require-call';
import { removeBinding } from '@nodejs/codemod-utils/ast-grep/remove-binding';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import type { SgRoot, SgNode, Edit, Range } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';

// Clean up unused imports using removeBinding
const allIsMethods = [
	'isArray',
	'isBoolean',
	'isBuffer',
	'isDate',
	'isError',
	'isFunction',
	'isNull',
	'isNullOrUndefined',
	'isNumber',
	'isObject',
	'isPrimitive',
	'isRegExp',
	'isString',
	'isSymbol',
	'isUndefined',
];

// helper to test named import specifiers (kept at module root so it's not re-created per run)
function hasAnyOtherNamedImports(spec: SgNode<JS>): boolean {
	const firstIdent = spec.find({ rule: { kind: 'identifier' } });
	const name = firstIdent?.text();
	return Boolean(name && allIsMethods.includes(name));
}

// Map deprecated util.is*() calls to their modern equivalents
const replacements = new Map<string, (arg: string) => string>([
	['isArray', (arg: string) => `Array.isArray(${arg})`],
	['isBoolean', (arg: string) => `typeof ${arg} === 'boolean'`],
	['isBuffer', (arg: string) => `Buffer.isBuffer(${arg})`],
	['isDate', (arg: string) => `${arg} instanceof Date`],
	['isError', (arg: string) => `Error.isError(${arg})`],
	['isFunction', (arg: string) => `typeof ${arg} === 'function'`],
	['isNull', (arg: string) => `${arg} === null`],
	[
		'isNullOrUndefined',
		(arg: string) => `${arg} === null || ${arg} === undefined`,
	],
	['isNumber', (arg: string) => `typeof ${arg} === 'number'`],
	['isObject', (arg: string) => `${arg} && typeof ${arg} === 'object'`],
	['isPrimitive', (arg: string) => `Object(${arg}) !== ${arg}`],
	['isRegExp', (arg: string) => `${arg} instanceof RegExp`],
	['isString', (arg: string) => `typeof ${arg} === 'string'`],
	['isSymbol', (arg: string) => `typeof ${arg} === 'symbol'`],
	['isUndefined', (arg: string) => `typeof ${arg} === 'undefined'`],
]);

/**
 * Transform function that converts deprecated util.is*() calls
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
 * 8. util.isNullOrUndefined() → value === null || value === undefined
 * 9. util.isNumber() → typeof value === 'number'
 * 10. util.isObject() → typeof value === 'object' && value !== null
 * 11. util.isPrimitive() → value !== Object(value)
 * 12. util.isRegExp() → value instanceof RegExp
 * 13. util.isString() → typeof value === 'string'
 * 14. util.isSymbol() → typeof value === 'symbol'
 * 15. util.isUndefined() → typeof value === 'undefined'
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	const usedMethods = new Set<string>();
	const nonIsMethodsUsed = new Set<string>();

	// Collect util import/require nodes once
	const importOrRequireNodes = [
		...getNodeRequireCalls(root, 'util'),
		...getNodeImportStatements(root, 'util'),
		...getNodeImportCalls(root, 'util'),
	];

	// Detect namespace/default identifiers to check for non-is usages later
	const namespaceBindings = new Set<string>();
	for (const node of importOrRequireNodes) {
		// namespace import: import * as ns from 'node:util'
		const nsImport = node.find({
			rule: { kind: 'namespace_import' },
		});
		if (nsImport) {
			const id = nsImport.find({ rule: { kind: 'identifier' } });
			if (id) namespaceBindings.add(id.text());
		}

		// default import: import util from 'node:util'
		const importClause =
			(node.kind() === 'import_statement' || node.kind() === 'import_clause') &&
			(node.find({ rule: { kind: 'import_clause' } }) ?? node);

		if (importClause) {
			const hasNamed = Boolean(
				importClause.find({ rule: { kind: 'named_imports' } }),
			);
			if (!hasNamed) {
				const defaultId = importClause.find({
					rule: {
						kind: 'identifier',
						not: { inside: { kind: 'namespace_import' } },
					},
				});
				if (defaultId) namespaceBindings.add(defaultId.text());
			}
		}

		// require namespace: const util = require('node:util')
		const reqNs = getRequireNamespaceIdentifier(node);
		if (reqNs) namespaceBindings.add(reqNs.text());

		// dynamic import namespace: const util = await import('node:util')
		if (node.kind() === 'variable_declarator') {
			const nameField = node.field('name');
			// If not an identifier (i.e., object pattern), skip adding as namespace
			const nameIdent =
				nameField?.kind() === 'identifier'
					? nameField
					: node.find({
							rule: {
								kind: 'identifier',
								inside: { kind: 'variable_declarator' },
							},
						});

			const hasObjectPattern = Boolean(
				node.find({ rule: { kind: 'object_pattern' } }),
			);
			if (!hasObjectPattern && nameIdent) {
				namespaceBindings.add(nameIdent.text());
			}
		}
	}

	// Mark non-is util usages for any namespace binding discovered
	for (const ns of namespaceBindings) {
		const usages = rootNode.findAll({
			rule: { pattern: `${ns}.$METHOD($$$)` },
		});
		for (const usage of usages) {
			const methodMatch = usage.getMatch('METHOD');
			if (methodMatch) {
				const methodName = methodMatch.text();
				if (!replacements.has(methodName)) nonIsMethodsUsed.add(methodName);
			}
		}
	}

	// Resolve local bindings for each util.is* and replace invocations
	const localRefsByMethod = new Map<string, Set<string>>();
	for (const method of replacements.keys()) {
		localRefsByMethod.set(method, new Set());
		for (const node of importOrRequireNodes) {
			const resolved = resolveBindingPath(node, `$.${method}`);
			if (resolved) localRefsByMethod.get(method)!.add(resolved);
		}
	}

	for (const [method, replacement] of replacements) {
		const refs = localRefsByMethod.get(method)!;
		for (const ref of refs) {
			const calls = rootNode.findAll({ rule: { pattern: `${ref}($ARG)` } });

			if (!calls.length) continue;

			for (const call of calls) {
				const arg = call.getMatch('ARG');
				if (!arg) continue;
				const newCallText = replacement(arg.text());
				edits.push(call.replace(newCallText));
				usedMethods.add(method);
			}
		}
	}

	if (!edits.length) return null;

	const importStatements = getNodeImportStatements(root, 'util');
	for (const importNode of importStatements) {
		const hasNamespace = Boolean(
			importNode.find({ rule: { kind: 'namespace_import' } }),
		);
		const namedImportSpecifiers = importNode.findAll({
			rule: { kind: 'import_specifier' },
		});
		const hasNamed = namedImportSpecifiers.length > 0;
		const defaultIdentifier = getDefaultImportIdentifier(importNode);

		// If all named specifiers are util.is* and there is no default or namespace, drop whole line
		if (
			hasNamed &&
			!defaultIdentifier &&
			!hasNamespace &&
			namedImportSpecifiers.every((spec) => hasAnyOtherNamedImports(spec))
		) {
			linesToRemove.push(importNode.range());
			continue;
		}

		// Otherwise, remove only named is* bindings; after replacement they are unused
		for (const method of allIsMethods) {
			const change = removeBinding(importNode, method);
			if (change?.edit) edits.push(change.edit);
			if (change?.lineToRemove) linesToRemove.push(change.lineToRemove);
		}

		// If no other util.is* methods are used, drop default/namespace imports entirely
		if (nonIsMethodsUsed.size === 0) {
			if ((hasNamespace && !hasNamed) || (defaultIdentifier && !hasNamed)) {
				linesToRemove.push(importNode.range());
			}
		}
	}

	const requireStatements = getNodeRequireCalls(root, 'util');
	for (const requireNode of requireStatements) {
		const objectPattern = requireNode.find({
			rule: { kind: 'object_pattern' },
		});
		if (objectPattern) {
			const shorthand = objectPattern.findAll({
				rule: { kind: 'shorthand_property_identifier_pattern' },
			});
			const pairs = objectPattern.findAll({ rule: { kind: 'pair_pattern' } });
			const importedNames: string[] = [];
			for (const s of shorthand) importedNames.push(s.text());
			for (const p of pairs) {
				const key = p.find({ rule: { kind: 'property_identifier' } });
				if (key) importedNames.push(key.text());
			}
			if (
				importedNames.length > 0 &&
				importedNames.every((n) => allIsMethods.includes(n))
			) {
				linesToRemove.push(requireNode.range());
				continue;
			}
		}

		// Otherwise, remove named util.is* bindings; after replacement they are unused
		for (const method of allIsMethods) {
			const change = removeBinding(requireNode, method);
			if (change?.edit) edits.push(change.edit);
			if (change?.lineToRemove) linesToRemove.push(change.lineToRemove);
		}

		// If no other util.* methods are used, drop namespace requires entirely
		if (nonIsMethodsUsed.size === 0) {
			const reqNs = getRequireNamespaceIdentifier(requireNode);
			const hasObject = Boolean(objectPattern);
			if (reqNs && !hasObject) linesToRemove.push(requireNode.range());
		}
	}

	// Handle dynamic import variable declarators and import().then chains
	const importCallStatements = rootNode.findAll({
		rule: {
			kind: 'variable_declarator',
			all: [
				{
					has: {
						field: 'name',
						any: [{ kind: 'object_pattern' }, { kind: 'identifier' }],
					},
				},
				{
					has: {
						field: 'value',
						kind: 'await_expression',
						has: {
							kind: 'call_expression',
							all: [
								{ has: { field: 'function', kind: 'import' } },
								{
									has: {
										field: 'arguments',
										kind: 'arguments',
										has: {
											kind: 'string',
											has: {
												kind: 'string_fragment',
												regex: '(node:)?util$',
											},
										},
									},
								},
							],
						},
					},
				},
			],
		},
	});
	for (const importCall of importCallStatements) {
		// Clean up destructured bindings like: const { isArray } = await import('node:util')
		const objectPattern = importCall.find({ rule: { kind: 'object_pattern' } });
		if (objectPattern) {
			const shorthand = objectPattern.findAll({
				rule: { kind: 'shorthand_property_identifier_pattern' },
			});
			const pairs = objectPattern.findAll({ rule: { kind: 'pair_pattern' } });
			const importedNames: string[] = [];
			for (const s of shorthand) importedNames.push(s.text());
			for (const p of pairs) {
				const key = p.find({ rule: { kind: 'property_identifier' } });
				if (key) importedNames.push(key.text());
			}
			if (
				importedNames.length > 0 &&
				importedNames.every((n) => allIsMethods.includes(n))
			) {
				linesToRemove.push(importCall.range());
				continue;
			}

			// Otherwise, remove named util.is* bindings; after replacement they are unused
			for (const method of allIsMethods) {
				const change = removeBinding(importCall, method);
				if (change?.edit) edits.push(change.edit);
				if (change?.lineToRemove) linesToRemove.push(change.lineToRemove);
			}
		} else {
			// Namespace dynamic import: const util = await import('node:util')
			// If no other util.* methods are used, drop the whole declaration
			if (
				nonIsMethodsUsed.size === 0 &&
				importCall.kind() === 'variable_declarator'
			) {
				const nameField = importCall.field('name');
				if (nameField?.kind() === 'identifier') {
					linesToRemove.push(importCall.range());
				}
			}
		}

		// Note: we do not handle import().then chains here to keep scope minimal without utility updates
	}

	let sourceCode = rootNode.commitEdits(edits);
	// Remove all lines marked for removal (including the whole util require/import if needed)
	sourceCode = removeLines(sourceCode, linesToRemove);

	return sourceCode;
}

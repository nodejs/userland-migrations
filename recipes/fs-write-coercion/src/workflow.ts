import {
	getNodeImportStatements,
	getNodeImportCalls,
} from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import type { SgRoot, Edit, SgNode } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

/**
 * fs write functions where the data parameter is the 2nd argument.
 */
const TARGET_FUNCTIONS = [
	{ path: '$.writeFile', prop: 'writeFile' },
	{ path: '$.writeFileSync', prop: 'writeFileSync' },
	{ path: '$.appendFile', prop: 'appendFile' },
	{ path: '$.appendFileSync', prop: 'appendFileSync' },
	{ path: '$.write', prop: 'write' },
	// promises API
	{ path: '$.promises.writeFile', prop: 'writeFile' },
	{ path: '$.promises.appendFile', prop: 'appendFile' },
];

/**
 * Check if a text expression is already a safe type that doesn't need String() wrapping.
 * Safe types: string literals, template literals, Buffer/TypedArray expressions,
 * already-wrapped String() or .toString() calls.
 */
function isSafeType(text: string): boolean {
	const trimmed = text.trim();

	// String literals and template literals (', ", `)
	if (/^['"`]/.test(trimmed)) return true;

	// Already has .toString()
	if (trimmed.endsWith('.toString()')) return true;

	// Already wrapped in String() — exact match to avoid false positives like Stringify()
	if (/^String\(/.test(trimmed) && trimmed.endsWith(')')) return true;

	// Buffer.from(), Buffer.alloc(), etc.
	if (/^Buffer\.\w+\(/.test(trimmed)) return true;

	// new Uint8Array, new Int8Array, etc.
	if (
		/^new\s+(Uint8Array|Int8Array|Uint16Array|Int16Array|Uint32Array|Int32Array|Float32Array|Float64Array|DataView)\b/.test(
			trimmed,
		)
	)
		return true;

	// Numeric literal (integers and floats)
	if (/^\d+(\.\d+)?$/.test(trimmed)) return true;

	// null or undefined
	if (trimmed === 'null' || trimmed === 'undefined') return true;

	return false;
}

/**
 * fs.write() has two overloaded signatures:
 * 1. fs.write(fd, buffer, offset, length, position, callback) — buffer overload (>=4 args typically)
 * 2. fs.write(fd, string, position, encoding, callback) — string overload
 *
 * When called with >= 4 args where the 3rd arg looks like a numeric offset,
 * it's likely the buffer overload — skip wrapping to avoid corrupting Buffer data.
 */
function isLikelyBufferOverload(args: readonly { text: () => string }[]): boolean {
	if (args.length < 4) return false;
	const thirdArg = args[2]!.text().trim();
	// If the 3rd argument is a numeric literal (offset), it's likely the buffer overload
	return /^\d+$/.test(thirdArg);
}

/**
 * Transform function that adds explicit String() conversion for objects
 * passed as the data parameter to fs write functions.
 *
 * See DEP0162: https://nodejs.org/api/deprecations.html#DEP0162
 *
 * Handles:
 * - fs.writeFile(file, data, ...) → fs.writeFile(file, String(data), ...)
 * - fs.writeFileSync(file, data, ...) → fs.writeFileSync(file, String(data), ...)
 * - fs.appendFile(path, data, ...) → fs.appendFile(path, String(data), ...)
 * - fs.appendFileSync(path, data, ...) → fs.appendFileSync(path, String(data), ...)
 * - fs.write(fd, data, ...) → fs.write(fd, String(data), ...)
 * - fsPromises.writeFile/appendFile
 * - Destructured imports: writeFile(path, data) → writeFile(path, String(data))
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	// Gather fs import/require statements (both 'fs' and 'fs/promises')
	const stmtNodes = [
		...getNodeRequireCalls(root, 'fs'),
		...getNodeImportStatements(root, 'fs'),
		...getNodeImportCalls(root, 'fs'),
		...getNodeRequireCalls(root, 'fs/promises'),
		...getNodeImportStatements(root, 'fs/promises'),
		...getNodeImportCalls(root, 'fs/promises'),
	];

	if (!stmtNodes.length) return null;

	for (const stmt of stmtNodes) {
		for (const target of TARGET_FUNCTIONS) {
			const local = resolveBindingPath(stmt, target.path);
			if (!local) continue;

			// Find all call expressions for this binding
			const calls = rootNode.findAll({
				rule: {
					kind: 'call_expression',
					has: {
						field: 'function',
						any: [
							{ kind: 'identifier', regex: `^${escapeRegex(local)}$` },
							{
								kind: 'member_expression',
								has: {
									field: 'property',
									kind: 'property_identifier',
									regex: `^${escapeRegex(target.prop)}$`,
								},
							},
						],
					},
				},
			});

			for (const call of calls) {
				// Get the arguments node
				const argsNode = call.find({ rule: { kind: 'arguments' } });
				if (!argsNode) continue;

				// Get all direct child nodes that are arguments (skip commas, parens)
				const args = argsNode
					.children()
					.filter(
						(child) =>
							child.kind() !== ',' &&
							child.kind() !== '(' &&
							child.kind() !== ')',
					);

				// Data is the 2nd argument (index 1)
				if (args.length < 2) continue;

				// For fs.write(), skip the buffer overload:
				// fs.write(fd, buffer, offset, length, ...) — wrapping buffer with String() is wrong
				if (target.prop === 'write' && isLikelyBufferOverload(args)) continue;

				const dataArg = args[1]!;
				const dataText = dataArg.text();

				// Skip if already a safe type
				if (isSafeType(dataText)) continue;

				// Wrap with String()
				edits.push(dataArg.replace(`String(${dataText})`));
			}
		}
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

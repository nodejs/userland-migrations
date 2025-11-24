import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import { removeBinding } from '@nodejs/codemod-utils/ast-grep/remove-binding';
import type { Edit, Range, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';

type Binding = {
	path: string;
	lastPropertyAccess?: string;
	propertyAccess?: string;
	depth: number;
	node: SgNode<JS>;
};

/**
 * Extracts property access information from a dot-notation path string.
 *
 * @param path - A dot-notation string representing a property path (e.g., "object.property.subProperty")
 * @returns An object containing:
 *   - `path`: The original path string
 *   - `lastPropertyAccess`: The last segment of the path (e.g., "subProperty" from "object.property.subProperty")
 *   - `propertyAccess`: The path without the last segment (e.g., "object.property" from "object.property.subProperty")
 *   - `depth`: The number of segments in the path
 *
 * @example
 * ```typescript
 * createPropBinding("foo.bar.baz");
 * // Returns: { path: "foo.bar.baz", propertyAccess: "foo.bar", lastPropertyAccess: "baz", depth: 3 }
 *
 * createPropBinding("foo");
 * // Returns: { path: "foo", propertyAccess: "", lastPropertyAccess: "foo", depth: 1 }
 * ```
 */
function createPropBinding(
	path: string,
): Pick<Binding, 'path' | 'lastPropertyAccess' | 'propertyAccess' | 'depth'> {
	const pathArr = path.split('.');

	const lastPropertyAccess = pathArr.at(-1);
	const propertyAccess = pathArr.slice(0, -1).join('.');

	return {
		path,
		propertyAccess,
		lastPropertyAccess,
		depth: pathArr.length,
	};
}

/**
 * Transforms `util.types.isWebAssemblyCompiledModule` usage to `instanceof WebAssembly.Module`.
 *
 * This transformation handles various import/require patterns and usage scenarios:
 *
 * 1. Identifies all require/import statements from 'node:util' or 'util' module that
 *    include access to `types.isWebAssemblyCompiledModule`
 *
 * 2. Replaces all matching code references:
 *    - `util.types.isWebAssemblyCompiledModule(value)` → `value instanceof WebAssembly.Module`
 *    - `types.isWebAssemblyCompiledModule(value)` → `value instanceof WebAssembly.Module`
 *    - `isWebAssemblyCompiledModule(value)` → `value instanceof WebAssembly.Module`
 *
 * 3. Removes unused bindings when all references to the imported/required
 *    isWebAssemblyCompiledModule have been replaced
 *
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const bindings: Binding[] = [];
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	const statements = [
		...getNodeRequireCalls(root, 'util'),
		...getNodeImportStatements(root, 'util'),
	];

	// if no imports are present it means that we don't need to process the file
	if (!statements.length) return null;

	for (const stmt of statements) {
		const bindToReplace = resolveBindingPath(stmt, '$.types.isWebAssemblyCompiledModule');

		if (!bindToReplace) {
			continue;
		}

		bindings.push({
			...createPropBinding(bindToReplace),
			node: stmt,
		});
	}

	for (const binding of bindings) {
		const nodes = rootNode.findAll({
			rule: {
				pattern: `${binding.propertyAccess || binding.path}${binding.depth > 1 ? '.$$$FN' : ''}`,
			},
		});

		// Find all function calls to isWebAssemblyCompiledModule
		const nodesToEdit = rootNode.findAll({
			rule: {
				pattern: `${binding.path}($ARG)`,
			},
		});

		for (const node of nodesToEdit) {
			// Extract the argument from the function call using getMatch
			const argNode = node.getMatch('ARG');
			if (argNode) {
				const argText = argNode.text();
				
				// Check if this call is inside a unary ! (NOT) expression
				// We check if parent is a unary_expression and has '!' operator
				const parent = node.parent();
				const isNegated = parent?.kind() === 'unary_expression' && 
					parent.find({ rule: { pattern: '!' } }) !== undefined;
				
				// Replace the entire call expression with instanceof check
				// Wrap in parentheses if negated to preserve operator precedence
				const replacement = isNegated 
					? `(${argText} instanceof WebAssembly.Module)`
					: `${argText} instanceof WebAssembly.Module`;
				
				edits.push(node.replace(replacement));
			}
		}

		if (nodes.length === nodesToEdit.length) {
			const bindToRemove = binding.path.includes('.')
				? binding.path.split('.')[0]
				: binding.path;

			const result = removeBinding(binding.node, bindToRemove);

			if (result?.edit) {
				edits.push(result.edit);
			}

			if (result?.lineToRemove) {
				linesToRemove.push(result.lineToRemove);
			}
		}
	}

	if (!edits.length) return null;

	const sourceCode = rootNode.commitEdits(edits);

	return removeLines(sourceCode, linesToRemove);
}

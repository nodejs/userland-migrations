import type { Edit, Range, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import { removeBinding } from '@nodejs/codemod-utils/ast-grep/remove-binding';
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

	if (!pathArr) {
		return {
			path,
			depth: 1,
		};
	}

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
 * Transforms `util.types.isNativeError` usage to `Error.isError`.
 *
 * This transformation handles various import/require patterns and usage scenarios:
 *
 * 1. Identifies all require/import statements from 'node:util' or 'util' module that
 *    include access to `types.isNativeError`
 *
 * 2. Replaces all matching code references:
 *    - `util.types.isNativeError(...)` → `Error.isError(...)`
 *    - `types.isNativeError(...)` → `Error.isError(...)`
 *    - `isNativeError(...)` → `Error.isError(...)`
 *
 * 3. Removes unused bindings when all references to the imported/required
 *    isNativeError have been replaced
 *
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const bindings: Binding[] = [];
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	const nodeRequires = getNodeRequireCalls(root, 'util');
	const nodeImports = getNodeImportStatements(root, 'util');
	const path = '$.types.isNativeError';

	for (const stmt of [...nodeRequires, ...nodeImports]) {
		const bindToReplace = resolveBindingPath(stmt, path);

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

		const nodesToEdit = rootNode.findAll({
			rule: {
				pattern: binding.path,
			},
		});

		for (const node of nodesToEdit) {
			edits.push(node.replace('Error.isError'));
		}

		if (nodes.length === nodesToEdit.length) {
			const bindToRemove = binding.path.includes('.')
				? binding.path.split('.').at(0)!
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

	const sourceCode = rootNode.commitEdits(edits);
	return removeLines(sourceCode, linesToRemove);
}

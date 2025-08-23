import type { SgNode, Edit, Range, Kinds, TypesMap } from "@codemod.com/jssg-types/main";
import { updateBinding } from "./update-binding.ts";

/**
 * Removes a specific binding from an import or require statement.
 *
 * Analyzes the provided AST node to find and remove a specific binding from destructured imports.
 * If the binding is the only one in the statement, the entire import line is marked for removal.
 * If there are multiple bindings, only the specified binding is removed from the destructuring pattern.
 *
 * @param node - The AST node representing the import or require statement
 * @param binding - The name of the binding to remove (e.g., "isNativeError")
 * @returns An object containing either an edit operation or a line range to remove, or undefined if no binding found
 *
 * @example
 * ```typescript
 * // Given an import: const {types, isNativeError} = require("node:util")
 * // And binding: "isNativeError"
 * // Returns: an edit object that transforms to: const {types} = require("node:util")
 * ```
 *
 * @example
 * ```typescript
 * // Given an import: const {isNativeError} = require("node:util")
 * // And binding: "isNativeError"
 * // Returns: {lineToRemove: Range} to remove the entire line
 * ```
 *
 * @example
 * ```typescript
 * // Given an import: const util = require("node:util")
 * // And binding: "isNativeError"
 * // Returns: undefined (no destructured binding found)
 * ```
 */
export function removeBinding(node: SgNode<TypesMap, Kinds<TypesMap>>, binding: string) {
	return updateBinding(node, binding, {
		newBinding: undefined,
	});
}

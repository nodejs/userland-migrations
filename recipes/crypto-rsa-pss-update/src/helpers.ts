import type { SgRoot, SgNode } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";
import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";
import { VALUE_NODE_KINDS } from "./constants";

/**
 * Safely extracts and trims text from an AST node
 */
export function safeText(node: SgNode<JS> | undefined): string | undefined {
	return node?.text()?.trim();
}

/**
 * Gets valid text from a node, returns null if node is missing or text is empty
 */
export function getValidText(node: SgNode<JS> | undefined): string | null {
	if (!node) return null;
	const text = safeText(node);
	return text || null;
}

/**
 * Gets both import statements and require calls for a module
 */
export function getModuleStatements(root: SgRoot<JS>, moduleName: string): SgNode<JS>[] {
	// Cast to ast-grep types that the utils functions expect
	const astGrepRoot = root as any;
	const importStatements = getNodeImportStatements(astGrepRoot, moduleName) as any[];
	const requireCalls = getNodeRequireCalls(astGrepRoot, moduleName) as any[];
	return [...importStatements, ...requireCalls] as SgNode<JS>[];
}

/**
 * Gets the value node from a pair using the common AST node types
 */
export function getValueNodeFromPair(pair: SgNode<JS>): SgNode<JS> | undefined {
	return pair.find({
		rule: {
			any: VALUE_NODE_KINDS.map((kind: string) => ({ kind }))
		}
	});
}

/**
 * Resolves binding paths from statements using resolveBindingPath
 */
export function resolveBindings(statements: SgNode<JS>[], paths: string | string[]): string[] {
	const pathArray = Array.isArray(paths) ? paths : [paths];
	
	return statements.flatMap(stmt => 
		pathArray
			.map(path => resolveBindingPath(stmt, path))
			.filter(Boolean)
	);
}

/**
 * Extracts OPTIONS match from crypto calls, filtering out null results
 */
export function getOptionsFromCalls(allCalls: SgNode<JS>[]): SgNode<JS>[] {
	return allCalls
		.map(call => call.getMatch("OPTIONS"))
		.filter(Boolean);
}

/**
 * Validates if a key is hash or mgf1Hash
 */
export function isValidHashKey(key: string | undefined): key is "hash" | "mgf1Hash" {
	return key === "hash" || key === "mgf1Hash";
}
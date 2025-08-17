import type { SgRoot, SgNode } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";
import { getModuleStatements, getValidText, resolveBindings } from "./helpers";
import { CRYPTO_FUNCTIONS } from "./constants";

/**
 * Finds promisified declarations for a specific binding and promisify function
 */
export function findPromisifiedDeclarations(rootNode: SgNode<JS>, binding: string, promisifyBinding: string): string[] {
	const promisified = rootNode.findAll({
		rule: {
			kind: "lexical_declaration",
			has: {
				kind: "variable_declarator",
				has: {
					kind: "call_expression",
					pattern: `${promisifyBinding}(${binding})`
				}
			}
		}
	});

	return promisified
		.map(decl => {
			const variableDeclarator = decl.find({ rule: { kind: "variable_declarator" }});
			const identifier = variableDeclarator?.child(0);
			return identifier?.kind() === "identifier" ? getValidText(identifier) : null;
		})
		.filter(Boolean);
}

/**
 * Find promisified wrappers that use crypto bindings discovered by resolveBindingPath
 */
export function getPromisifiedBindings(root: SgRoot<JS>, existingBindings: string[]): string[] {
	const rootNode = root.root();

	// Resolve promisify bindings from util imports
	const utilStatements = getModuleStatements(root, "util");
	const promisifyBindings = resolveBindings(utilStatements, "$.promisify");

	// If no promisify bindings found, check if there's a util import for fallback
	if (promisifyBindings.length === 0 && utilStatements.length > 0) {
		promisifyBindings.push("util.promisify");
	}

	// Find all promisified bindings using flatMap to eliminate nested loops
	const allPromisified = existingBindings.flatMap(binding => 
		promisifyBindings.flatMap(promisifyBinding => 
			findPromisifiedDeclarations(rootNode, binding, promisifyBinding)
		)
	);

	// Remove duplicates
	return Array.from(new Set(allPromisified));
}

/**
 * Analyzes imports and requires to determine all possible identifiers
 * that could refer to generateKeyPair or generateKeyPairSync functions
 */
export function getCryptoBindings(root: SgRoot<JS>): string[] {
	// Handle both ES6 imports and CommonJS requires
	const bindings = resolveBindings(getModuleStatements(root, "crypto"), CRYPTO_FUNCTIONS);

	// Find promisified assignments that use the discovered bindings
	const promisifiedBindings = getPromisifiedBindings(root, bindings);
	bindings.push(...promisifiedBindings);

	return bindings;
}

/**
 * Find all function calls that match the crypto bindings
 */
export function findCryptoCalls(rootNode: SgNode<JS>, bindings: string[]) {
	return bindings
		.flatMap(bindingName => rootNode.findAll({
			rule: {
				any: [
					{ pattern: `${bindingName}($TYPE, $OPTIONS, $CALLBACK)` },
					{ pattern: `${bindingName}($TYPE, $OPTIONS)` }
				]
			}
		}));
}
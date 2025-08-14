import type { SgRoot, SgNode, Edit } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";
import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";

/**
 * Transform function that updates deprecated RSA-PSS crypto options.
 *
 * Handles:
 * 1. Property transformations in RSA-PSS key generation options:
 *    - `hash: 'sha256'` → `hashAlgorithm: 'sha256'`
 *    - `mgf1Hash: 'sha1'` → `mgf1HashAlgorithm: 'sha1'`
 * 2. Function call targeting: Only crypto.generateKeyPair() and crypto.generateKeyPairSync()
 * 3. Key type filtering: Only applies to 'rsa-pss' key type (ignores 'rsa', 'ed25519', etc.)
 * 4. Import pattern support: ES6 imports, CommonJS requires, destructuring, aliases, namespace imports
 * 5. Variable key type support: Handles variables containing 'rsa-pss' (e.g., const keyType = 'rsa-pss')
 * 6. Promisified wrapper support: Handles util.promisify(crypto.generateKeyPair) patterns
 * 7. Value preservation: Maintains string literals, identifiers, template literals, and variable references
 * 8. Template literal handling: Extracts identifiers from template strings like `${variable}`
 *
 * Only applies to crypto.generateKeyPair() and crypto.generateKeyPairSync()
 * calls with 'rsa-pss' as the first argument.
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();

	// Collect all possible function names that could be generateKeyPair or generateKeyPairSync
	const cryptoBindings = getCryptoBindings(root);

	// Find all potential calls using any of the identified bindings
	const allCalls = findCryptoCalls(rootNode, cryptoBindings);

	// Process all RSA-PSS calls and get transformations
	const { edits, hasChanges } = processRsaPssCalls(rootNode, allCalls);

	if (!hasChanges) return null;

	return rootNode.commitEdits(edits);
}

/**
 * Resolves a variable identifier to its string literal value if it's 'rsa-pss'
 */
function resolveVariableValue(rootNode: SgNode<JS>, identifier: string): boolean {
	// Look for variable declarations like: const keyType = 'rsa-pss'
	const declarations = rootNode.findAll({
		rule: {
			pattern: `const ${identifier} = $VALUE`
		}
	});

	for (const decl of declarations) {
		const valueMatch = decl.getMatch("VALUE");
		if (valueMatch) {
			const valueText = valueMatch.text()?.trim();
			if (valueText && /^['"]rsa-pss['"]$/.test(valueText)) {
				return true;
			}
		}
	}

	// Also check let declarations
	const letDeclarations = rootNode.findAll({
		rule: {
			pattern: `let ${identifier} = $VALUE`
		}
	});

	for (const decl of letDeclarations) {
		const valueMatch = decl.getMatch("VALUE");
		if (valueMatch) {
			const valueText = valueMatch.text()?.trim();
			if (valueText && /^['"]rsa-pss['"]$/.test(valueText)) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Processes RSA-PSS generateKeyPair calls and transforms deprecated options
 */
function processRsaPssCalls(rootNode: SgNode<JS>, allCalls: SgNode<JS>[]): { edits: Edit[], hasChanges: boolean } {
	const edits: Edit[] = [];
	let hasChanges = false;

	for (const call of allCalls) {
		const typeMatch = call.getMatch("TYPE");
		const optionsMatch = call.getMatch("OPTIONS");

		if (!typeMatch || !optionsMatch) continue;

		// Only process 'rsa-pss' key type
		const typeText = typeMatch.text()?.trim();
		if (!typeText) continue;

		// Check if it's a string literal 'rsa-pss' or "rsa-pss"
		const isStringLiteral = /^['"]rsa-pss['"]$/.test(typeText);
		
		// Check if it's a variable that resolves to 'rsa-pss'
		const isVariableWithRsaPss = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(typeText) && 
			resolveVariableValue(rootNode, typeText);

		if (!isStringLiteral && !isVariableWithRsaPss) {
			continue;
		}

		// Find the object node that contains the options
		const objectNode = optionsMatch.find({
			rule: {
				kind: "object"
			}
		});

		if (!objectNode) continue;

		// Find all property pairs in the object
		const pairs = objectNode.findAll({
			rule: {
				kind: "pair"
			}
		});

		// Transform hash and mgf1Hash properties
		for (const pair of pairs) {
				const keyNode = pair.find({
					rule: {
						any: [
							{
								regex: "hash",
								kind: "property_identifier",
							},
							{
								regex: "mgf1Hash",
								kind: "property_identifier",
							},
						],
					},
				});
				if (!keyNode) continue;
				const key = keyNode.text()?.trim();
				if (!key || (key !== "hash" && key !== "mgf1Hash")) continue;

				// Get the value node to preserve it in the transformation
				const valueNode = pair.find({
					rule: {
						kind: "string"
					}
				}) || pair.find({
					rule: {
						kind: "identifier"
					}
				}) || pair.find({
					rule: {
						kind: "template_string"
					}
				}) || pair.find({
					rule: {
						kind: "member_expression"  // For cases like crypto.constants.SHA256
					}
				}) || pair.find({
					rule: {
						kind: "call_expression"    // For cases like getHash()
					}
				}) || pair.find({
					rule: {
						kind: "binary_expression"  // For cases like 'sha' + '256'
					}
				}) || pair.find({
					rule: {
						kind: "conditional_expression"  // For cases like condition ? 'sha512' : 'sha256'
					}
				});

				if (!valueNode) continue;

				const value = valueNode.text()?.trim();
				if (!value) continue;

				hasChanges = true;


				if (key === "hash") {
					edits.push(pair.replace(`hashAlgorithm: ${value}`));
				} else if (key === "mgf1Hash") {
					edits.push(pair.replace(`mgf1HashAlgorithm: ${value}`));
				}
			}
		}

	return { edits, hasChanges };
}

/**
 * Analyzes imports and requires to determine all possible identifiers
 * that could refer to generateKeyPair or generateKeyPairSync functions
 */
function getCryptoBindings(root: SgRoot<JS>): string[] {
	const bindings: string[] = [];

	// @ts-ignore - ast-grep types compatibility
	const importStatements = getNodeImportStatements(root, "crypto");
	// @ts-ignore - ast-grep types compatibility
	const requireCalls = getNodeRequireCalls(root, "crypto");

	// Handle both ES6 imports and CommonJS requires
	for (const stmt of [...importStatements, ...requireCalls]) {
		const generateKeyPairBinding = resolveBindingPath(stmt, "$.generateKeyPair");
		const generateKeyPairSyncBinding = resolveBindingPath(stmt, "$.generateKeyPairSync");

		if (generateKeyPairBinding) {
			bindings.push(generateKeyPairBinding);
		}
		if (generateKeyPairSyncBinding) {
			bindings.push(generateKeyPairSyncBinding);
		}
	}

	// Find promisified assignments that use the discovered bindings
	const promisifiedBindings = getPromisifiedBindings(root, bindings);
	bindings.push(...promisifiedBindings);

	return bindings;
}

/**
 * Find promisified wrappers that use crypto bindings discovered by resolveBindingPath
 */
function getPromisifiedBindings(root: SgRoot<JS>, existingBindings: string[]): string[] {
	const promisifiedBindings: string[] = [];
	const rootNode = root.root();

	for (const binding of existingBindings) {
		// Find: const someVar = util.promisify(crypto.generateKeyPair)
		// or:   const someVar = util.promisify(generateKeyPair) 
		const promisified = rootNode.findAll({
			rule: {
				pattern: `const $BINDING = util.promisify(${binding})`
			}
		});

		for (const decl of promisified) {
			const bindingMatch = decl.getMatch("BINDING");
			if (bindingMatch) {
				const bindingName = bindingMatch.text()?.trim();
				if (bindingName) {
					promisifiedBindings.push(bindingName);
				}
			}
		}
	}

	return promisifiedBindings;
}

/**
 * Find all function calls that match the crypto bindings
 */
function findCryptoCalls(rootNode: SgNode<JS>, bindings: string[]) {
	const allCalls = [];

	for (const bindingName of bindings) {
		// Generate patterns for each binding
		const patterns = [
			{ pattern: `${bindingName}($TYPE, $OPTIONS, $CALLBACK)` },
			{ pattern: `${bindingName}($TYPE, $OPTIONS)` }
		];

		const calls = rootNode.findAll({
			rule: {
				any: patterns
			}
		});

		allCalls.push(...calls);
	}

	return allCalls;
}
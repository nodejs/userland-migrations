import type { SgRoot, SgNode, Edit } from "@codemod.com/jssg-types/main";
import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";
import type JS from "@codemod.com/jssg-types/langs/javascript";

/**
 * Transform function that updates deprecated RSA-PSS crypto options.
 *
 * Transforms:
 * - hash → hashAlgorithm
 * - mgf1Hash → mgf1HashAlgorithm
 *
 * Only applies to crypto.generateKeyPair() and crypto.generateKeyPairSync()
 * calls with 'rsa-pss' as the first argument.
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	let hasChanges = false;
	const edits: Edit[] = [];

	// Collect all possible function names that could be generateKeyPair or generateKeyPairSync
	const cryptoBindings = getCryptoBindings(root);

	// Find all potential calls using any of the identified bindings
	const allCalls = findCryptoCalls(rootNode, cryptoBindings);

	for (const call of allCalls) {
		const typeMatch = call.getMatch("TYPE");
		const optionsMatch = call.getMatch("OPTIONS");

		if (!typeMatch || !optionsMatch) continue;

		// Only process 'rsa-pss' key type
		const typeText = typeMatch.text();
		if (!typeText.includes("'rsa-pss'") && !typeText.includes('"rsa-pss"')) {
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
				const key = keyNode.text();

				// Get the value node to preserve it in the transformation
				const valueNode = pair.find({
					rule: {
						kind: "string"
					}
				}) || pair.find({
					rule: {
						kind: "identifier"
					}
				});

				if (!valueNode) continue;

				hasChanges = true;
				const value = valueNode.text();

				if (key === "hash") {
					edits.push(pair.replace(`hashAlgorithm: ${value}`));
				}
				if (key === "mgf1Hash") {
					edits.push(pair.replace(`mgf1HashAlgorithm: ${value}`));
				}
			}
		}

	if (!hasChanges) return null;

	return rootNode.commitEdits(edits);
}

/**
 * Analyzes imports and requires to determine all possible identifiers
 * that could refer to generateKeyPair or generateKeyPairSync functions
 */
function getCryptoBindings(root: SgRoot<JS>): Map<string, string[]> {
	const bindings = new Map<string, string[]>();

	// @ts-ignore - ast-grep types compatibility
	const importStatements = getNodeImportStatements(root, "crypto");
	// @ts-ignore - ast-grep types compatibility
	const requireCalls = getNodeRequireCalls(root, "crypto");

	// Handle ES6 imports
	for (const importStmt of importStatements) {
		// Handle namespace imports: import * as crypto from 'node:crypto'
		const namespaceImport = importStmt.find({
			rule: {
				kind: "namespace_import"
			}
		});

		if (namespaceImport) {
			const keyPairPath = resolveBindingPath(importStmt, "$.generateKeyPair");
			const keyPairSyncPath = resolveBindingPath(importStmt, "$.generateKeyPairSync");
			if (keyPairPath) bindings.set(keyPairPath, ['generateKeyPair']);
			if (keyPairSyncPath) bindings.set(keyPairSyncPath, ['generateKeyPairSync']);
		}

		// Handle named imports: import { generateKeyPair, generateKeyPairSync } from 'node:crypto'
		const namedImports = importStmt.findAll({
			rule: {
				kind: "import_specifier"
			}
		});

		for (const namedImport of namedImports) {
			const importText = namedImport.text();

			// Handle aliased imports (e.g., generateKeyPair as foo)
			if (importText.includes(' as ')) {
				const [importName, aliasName] = importText.split(' as ').map(s => s.trim());
				if (importName === 'generateKeyPair' || importName === 'generateKeyPairSync') {
					bindings.set(aliasName, [importName]);
				}
			} else {
				// Handle direct imports (e.g., generateKeyPair)
				if (importText === 'generateKeyPair' || importText === 'generateKeyPairSync') {
					bindings.set(importText, [importText]);
				}
			}
		}
	}

	// Handle CommonJS requires
	for (const requireCall of requireCalls) {
		// Handle destructured requires: const { generateKeyPair: foo } = require('crypto')
		const objectPattern = requireCall.find({
			rule: {
				kind: "object_pattern"
			}
		});

		if (objectPattern) {
			const shorthandProps = objectPattern.findAll({
				rule: {
					kind: "shorthand_property_identifier_pattern"
				}
			});

			for (const prop of shorthandProps) {
				const propName = prop.text();
				if (propName === 'generateKeyPair' || propName === 'generateKeyPairSync') {
					bindings.set(propName, [propName]);
				}
			}

			// Handle renamed destructured requires
			const pairs = objectPattern.findAll({
				rule: {
					kind: "pair_pattern"
				}
			});

			for (const pair of pairs) {
				const pairText = pair.text();
				// Match pattern like "generateKeyPair: foo"
				const match = pairText.match(/^(\w+):\s*(\w+)$/);
				if (match) {
					const [, keyName, valueName] = match;
					if (keyName === 'generateKeyPair' || keyName === 'generateKeyPairSync') {
						bindings.set(valueName, [keyName]);
					}
				}
			}
		}

		// Handle namespace requires: const crypto = require('crypto')
		const identifier = requireCall.find({
			rule: {
				kind: "identifier"
			}
		});

		if (identifier && !objectPattern) {
			const name = identifier.text();
			bindings.set(`${name}.generateKeyPair`, ['generateKeyPair']);
			bindings.set(`${name}.generateKeyPairSync`, ['generateKeyPairSync']);
		}
	}

	return bindings;
}

/**
 * Find all function calls that match the crypto bindings
 */
function findCryptoCalls(rootNode: SgNode<JS>, bindings: Map<string, string[]>) {
	const allCalls = [];

	for (const [bindingName] of bindings) {
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
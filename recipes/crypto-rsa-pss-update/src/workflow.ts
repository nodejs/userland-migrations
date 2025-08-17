import type { SgRoot } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";
import { getCryptoBindings, findCryptoCalls } from "./binding-resolution";
import { processRsaPssCalls, transformSpreadObjectDeclarations, processThisPropertyReferences } from "./transformations";

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
 * 9. This property support: Handles this.property patterns in classes and objects
 *
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();

	const cryptoBindings = getCryptoBindings(root);

	const allCalls = findCryptoCalls(rootNode, cryptoBindings);

	const edits = processRsaPssCalls(rootNode, allCalls);

	const spreadEdits = transformSpreadObjectDeclarations(rootNode, allCalls);
	const thisPropertyEdits = processThisPropertyReferences(rootNode, allCalls);

	const allEdits = [...edits, ...spreadEdits, ...thisPropertyEdits];

	if (!allEdits.length) return null;

	return rootNode.commitEdits(allEdits);
}
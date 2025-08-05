import type { SgRoot, Edit } from "@codemod.com/jssg-types/main";

/**
 * Transform function that updates deprecated RSA-PSS crypto options.
 * 
 * Transforms:
 * - hash -> hashAlgorithm
 * - mgf1Hash -> mgf1HashAlgorithm
 * 
 * Only applies to crypto.generateKeyPair() and crypto.generateKeyPairSync() 
 * calls with 'rsa-pss' as the first argument.
 */
export default function transform(root: SgRoot): string | null {
	const rootNode = root.root();
	let hasChanges = false;
	const edits: Edit[] = [];

	// Find all generateKeyPair and generateKeyPairSync calls
	const generateKeyPairCalls = rootNode.findAll({
		rule: {
			any: [
				{ pattern: "crypto.generateKeyPair($TYPE, $OPTIONS, $CALLBACK)" },
				{ pattern: "crypto.generateKeyPair($TYPE, $OPTIONS)" },
				{ pattern: "generateKeyPair($TYPE, $OPTIONS, $CALLBACK)" },
				{ pattern: "generateKeyPair($TYPE, $OPTIONS)" }
			]
		}
	});

	const generateKeyPairSyncCalls = rootNode.findAll({
		rule: {
			any: [
				{ pattern: "crypto.generateKeyPairSync($TYPE, $OPTIONS)" },
				{ pattern: "generateKeyPairSync($TYPE, $OPTIONS)" }
			]
		}
	});

	// Process both generateKeyPair and generateKeyPairSync calls
	const allCalls = [...generateKeyPairCalls, ...generateKeyPairSyncCalls];

	for (const call of allCalls) {
		const typeMatch = call.getMatch("TYPE");
		const optionsMatch = call.getMatch("OPTIONS");

		if (!typeMatch || !optionsMatch) continue;

		// Only process 'rsa-pss' key type
		const typeText = typeMatch.text();
		if (!typeText.includes("'rsa-pss'") && !typeText.includes('"rsa-pss"')) {
			continue;
		}

		const optionsText = optionsMatch.text();
		let newOptionsText = optionsText;
		let optionsChanged = false;

		// Transform hash -> hashAlgorithm
		if (optionsText.includes("hash:")) {
			// Match hash: followed by value, but not hashAlgorithm:
			newOptionsText = newOptionsText.replace(/\bhash:\s*/g, "hashAlgorithm: ");
			optionsChanged = true;
		}

		// Transform mgf1Hash -> mgf1HashAlgorithm
		if (optionsText.includes("mgf1Hash:")) {
			newOptionsText = newOptionsText.replace(/\bmgf1Hash:\s*/g, "mgf1HashAlgorithm: ");
			optionsChanged = true;
		}

		if (optionsChanged) {
			// Replace the entire call with updated options
			const callText = call.text();
			const newCallText = callText.replace(optionsText, newOptionsText);
			edits.push(call.replace(newCallText));
			hasChanges = true;
		}
	}

	if (!hasChanges) return null;

	return rootNode.commitEdits(edits);
}
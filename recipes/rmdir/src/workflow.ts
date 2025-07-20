// jssg din't work correclty in npm workspaces, so we use relative imports
// also it's didn't work with ts paths aliases
// import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
// import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { getNodeImportStatements, isImportStatementSpread } from "../../../utils/src/ast-grep/import-statement.ts";
import { getNodeRequireCalls, isSpreadRequire } from "../../../utils/src/ast-grep/require-call.ts";
import type { SgRoot, Edit } from "@ast-grep/napi";

/**
 * Transform function that converts deprecated fs.rmdir calls
 * with recursive: true option to the new fs.rm API.
 *
 * Handles:
 * 1. fs.rmdir(path, { recursive: true }, callback) -> fs.rm(path, { recursive: true, force: true }, callback)
 * 2. fs.rmdir(path, { recursive: true }) -> fs.rm(path, { recursive: true, force: true })
 * 3. fs.rmdirSync(path, { recursive: true }) -> fs.rmSync(path, { recursive: true, force: true })
 * 4. fs.promises.rmdir(path, { recursive: true }) -> fs.promises.rm(path, { recursive: true, force: true })
 */
export default function transform(root: SgRoot): string | null {
	const rootNode = root.root();
	let hasChanges = false;
	const edits: Edit[] = [];

	const importStatements = getNodeImportStatements(root, 'fs');
	const requireStatements = getNodeRequireCalls(root, 'fs');

	for (const importNode of importStatements) {
		if (!isImportStatementSpread(importNode)) continue;

		const importText = importNode.text();
		const newImportText = importText.replace(/rmdir/g, 'rm');
		edits.push(importNode.replace(newImportText));
		hasChanges = true;
	}

	for (const requireNode of requireStatements) {
		if (!isSpreadRequire(requireNode)) continue;

		const requireText = requireNode.text();
		const newRequireText = requireText.replace(/rmdir/g, 'rm');
		edits.push(requireNode.replace(newRequireText));
		hasChanges = true;
	}

	const rmdirSyncCalls = rootNode.findAll({
		rule: {
			any: [
				{ pattern: "fs.rmdirSync($PATH, $OPTIONS)" },
			]
		}
	});

	const rmdirCalls = rootNode.findAll({
		rule: {
			any: [
				{ pattern: "fs.rmdir($PATH, $OPTIONS, $CALLBACK)" },
				{ pattern: "fs.rmdir($PATH, $OPTIONS)" },
			]
		}
	});

	const promisesRmdirCalls = rootNode.findAll({
		rule: {
			any: [
				{ pattern: "fs.promises.rmdir($PATH, $OPTIONS)" }
			]
		}
	});

	for (const call of rmdirSyncCalls) {
		// Check if this call has `recursive: true` option
		const optionsMatch = call.getMatch("OPTIONS");
		if (!optionsMatch) continue;
		const optionsText = optionsMatch.text();
		if (!optionsText.includes("recursive") || !optionsText.includes("true")) {
			continue;
		}
		const path = call.getMatch("PATH")?.text();
		const newCallText = `fs.rmSync(${path}, { recursive: true, force: true })`;
		edits.push(call.replace(newCallText));
		hasChanges = true;
	}

	for (const call of rmdirCalls) {
		const callText = call.text();
		// Check if this call has `recursive: true` option
		const optionsMatch = call.getMatch("OPTIONS");
		if (!optionsMatch) continue;
		const optionsText = optionsMatch.text();
		if (!optionsText.includes("recursive") || !optionsText.includes("true")) {
			continue;
		}
		let newCallText = "";
		if (callText.includes("fs.rmdir(")) {
			// Handle fs.rmdir → fs.rm
			if (call.getMatch("CALLBACK")) {
				// Has callback
				const path = call.getMatch("PATH")?.text();
				const callback = call.getMatch("CALLBACK")?.text();
				newCallText = `fs.rm(${path}, { recursive: true, force: true }, ${callback})`;
			} else {
				// No callback
				const path = call.getMatch("PATH")?.text();
				newCallText = `fs.rm(${path}, { recursive: true, force: true })`;
			}
		} else if (callText.includes("fs.promises.rmdir(")) {
			// Handle fs.promises.rmdir → fs.promises.rm
			const path = call.getMatch("PATH")?.text();
			newCallText = `fs.promises.rm(${path}, { recursive: true, force: true })`;
		}
		if (newCallText) {
			edits.push(call.replace(newCallText));
			hasChanges = true;
		}
	}

	for (const call of promisesRmdirCalls) {
		// Check if this call has `recursive: true` option
		const optionsMatch = call.getMatch("OPTIONS");
		if (!optionsMatch) continue;

		const optionsText = optionsMatch.text();
		if (!optionsText.includes("recursive") || !optionsText.includes("true")) {
			continue;
		}
		const path = call.getMatch("PATH")?.text();
		const newCallText = `fs.promises.rm(${path}, { recursive: true, force: true })`;
		edits.push(call.replace(newCallText));
		hasChanges = true;
	}

	if (!hasChanges) return null;

	return rootNode.commitEdits(edits);
}

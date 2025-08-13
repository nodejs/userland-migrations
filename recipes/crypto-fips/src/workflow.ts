import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";
import type { SgRoot, Edit, SgNode } from "@codemod.com/jssg-types/main";

const escapeRegExp = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Transform function that converts deprecated crypto.fips calls
 * to the new crypto.getFips() and crypto.setFips() syntax.
 *
 * Handles:
 * 1. crypto.fips -> crypto.getFips()
 * 2. crypto.fips = true -> crypto.setFips(true)
 * 3. crypto.fips = false -> crypto.setFips(false)
 */
export default function transform(root: SgRoot): string | null {
	const rootNode = root.root();
	let hasChanges = false;
	const edits: Edit[] = [];

	const cryptoBases = new Set<string>(getAllCryptoBasePaths(root));

	const assignmentResult = replaceAssignments(rootNode, cryptoBases);
	edits.push(...assignmentResult.edits);
	hasChanges = assignmentResult.hasChanges;

	const readResult = replaceReads(rootNode, cryptoBases);
	edits.push(...readResult.edits);
	hasChanges = readResult.hasChanges;

	if (!hasChanges) return null;
	return rootNode.commitEdits(edits);
}

function* getCryptoBasePaths(statements: SgNode[]) {
	for (const stmt of statements) {
		const resolvedPath = resolveBindingPath(stmt, "$.fips");
		if (!resolvedPath || !resolvedPath.includes(".")) continue;
		yield resolvedPath.slice(0, resolvedPath.lastIndexOf("."));
	}
}

function* getAllCryptoBasePaths(root: SgRoot) {
	yield* getCryptoBasePaths(getNodeRequireCalls(root, "crypto"));
	yield* getCryptoBasePaths(getNodeImportStatements(root, "crypto"));
}

function replaceAssignments(rootNode: SgNode, cryptoBases: Set<string>) {
	const edits: Edit[] = [];
	let hasChanges = false;

	for (const base of cryptoBases) {
		const assignments = rootNode.findAll({
			rule: {
				pattern: `${base}.fips = $VALUE`,
			},
		});

		for (const assign of assignments) {
			const valueText = assign.getMatch("VALUE")?.text() ?? "";
			const basePropRegex = new RegExp(`\\b${escapeRegExp(base)}\\.fips\\b`, "g");
			const transformedValue = valueText.replace(basePropRegex, `${base}.getFips()`);
			edits.push(assign.replace(`${base}.setFips(${transformedValue})`));
			hasChanges = true;
		}
	}

	return { edits, hasChanges };
}

function replaceReads(rootNode: SgNode, cryptoBases: Set<string>) {
	const edits: Edit[] = [];
	let hasChanges = false;

	for (const base of cryptoBases) {
		const reads = rootNode.findAll({
			rule: {
				pattern: `${base}.fips`,
			},
		});

		for (const read of reads) {
			edits.push(read.replace(`${base}.getFips()`));
			hasChanges = true;
		}
	}

	return { edits, hasChanges };
}

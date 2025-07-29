import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import type { SgRoot, Edit } from "@codemod.com/jssg-types/main";

/**
 * Transform function that converts deprecated fs.rmdir calls
 * with recursive: true option to the new fs.rm API.
 *
 * Handles:
 * 1. ...
 */
export default function transform(root: SgRoot): string | null {
	const rootNode = root.root();
	let hasChanges = false;
	const edits: Edit[] = [];

	// do things

	if (!hasChanges) return null;

	return rootNode.commitEdits(edits);
}

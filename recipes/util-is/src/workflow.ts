import type { SgRoot, Edit } from "@ast-grep/napi";

export default function transform(root: SgRoot): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	let hasChanges = false;

	if (!hasChanges) return null;

	return rootNode.commitEdits(edits);
}

import type { SgRoot, Edit } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";

export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	let hasChanges = false;

	// `url.format` is deprecated, so we replace it with `new URL().toString()`

	if (!hasChanges) return null;

	return rootNode.commitEdits(edits);
};


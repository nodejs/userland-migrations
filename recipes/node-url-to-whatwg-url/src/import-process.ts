import type { SgRoot, Edit } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";

export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	let hasChanges = false;

	// after the migration, `url.format` is deprecated, so we replace it with `new URL().toString()`
	// check remaining usages of `url` module and replace import statements accordingly
	// and require calls

	if (!hasChanges) return null;

	return rootNode.commitEdits(edits);
};


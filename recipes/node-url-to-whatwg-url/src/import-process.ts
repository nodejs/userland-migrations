import type { SgRoot, Edit } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";

export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	let hasChanges = false;

	// after the migration, replacement of `url.parse` and `url.format`
	// we need to check remaining usage of `url` module
	// if needed, we can remove the `url` import
	// we are going to use bruno's utility to resolve bindings

	if (!hasChanges) return null;

	return rootNode.commitEdits(edits);
};


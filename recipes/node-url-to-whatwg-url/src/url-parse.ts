import type { SgRoot, Edit } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";

/**
 * Transforms `url.parse` usage to `new URL()`. Handles direct global access
 *
 * See https://nodejs.org/api/deprecations.html#DEPDEP0116 for more details.
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	let hasChanges = false;

	// `url.parse` is deprecated, so we replace it with `new URL()`

	if (!hasChanges) return null;

	return rootNode.commitEdits(edits);
};


import type { SgRoot, Edit } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";

/**
 * Transforms `url.parse` usage to `new URL()`.
 *
 * See https://nodejs.org/api/deprecations.html#DEP0116 for more details.
 *
 * Handle:
 * 1. `url.parse(urlString)` → `new URL(urlString)`
 * 2. `parse(urlString)` → `new URL(urlString)`
 * if imported with aliases
 * 2. `foo.parse(urlString)` → `new URL(urlString)`
 * 3. `foo(urlString)` → `new URL(urlString)`
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	let hasChanges = false;

	// `url.parse` is deprecated, so we replace it with `new URL()`

	if (!hasChanges) return null;

	return rootNode.commitEdits(edits);
};


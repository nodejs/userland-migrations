import type { Edit, SgRoot } from '@codemod.com/jssg-types/main';
import type Json from '@codemod.com/jssg-types/langs/json';

/**
 * @see https://github.com/nodejs/package-examples/tree/main/guide/05-cjs-esm-migration/migrating-package-json
 */
export default function transform(root: SgRoot<Json>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	// do some stuff

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

import type { SgRoot, Edit } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';

/**
 * @see https://github.com/nodejs/package-examples/blob/main/guide/05-cjs-esm-migration/migrating-context-local-variables/README.md
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	// do some stuff

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

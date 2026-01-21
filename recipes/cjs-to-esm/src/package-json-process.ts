import type { Edit, SgRoot } from '@codemod.com/jssg-types/main';
import type Json from '@codemod.com/jssg-types/langs/json';

export default function transform(root: SgRoot<Json>): string | null {
	const rootNode = root.root();
	const edtis: Edit[] = [];

	// do some stuff

	if (!edtis.length) return null;

	return rootNode.commitEdits(edtis);
}

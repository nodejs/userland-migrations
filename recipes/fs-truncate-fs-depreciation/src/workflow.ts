import type { SgRoot, Edit } from "@codemod.com/jssg-types/main";

/**
 *
 */
export default function transform(root: SgRoot): string | null {
  const rootNode = root.root();
  const edits: Edit[] = [];
  let hasChanges = false;


  if (!hasChanges) return null;

  return rootNode.commitEdits(edits);
}

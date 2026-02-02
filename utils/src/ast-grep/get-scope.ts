import type { SgNode } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

/**
 * Traverses up the AST tree to find the enclosing scope of a given node.
 *
 * @param node - The AST node to find the scope for
 * @param customParent - Optional custom parent node type to stop at
 * @returns The scope node (statement_block, program, or custom parent) or null if not found
 *
 */
export const getScope = (node: SgNode<Js>, customParent?: string) => {
	let parentNode = node.parent();

	while (parentNode !== null) {
		switch (parentNode.kind()) {
			case 'statement_block':
			case 'program':
			case customParent:
				return parentNode;
			default:
				parentNode = parentNode.parent();
		}
	}
};

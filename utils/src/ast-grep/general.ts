import type { SgNode } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

export function findParentStatement(node: SgNode<Js>): SgNode<Js> | null {
	for (const ancestor of node.ancestors()) {
		if (ancestor.kind() === 'expression_statement') {
			return ancestor;
		}
	}
	return null;
}

export function isSafeResourceTarget(node: SgNode<Js>): boolean {
	return node.is('identifier') || node.is('member_expression');
}

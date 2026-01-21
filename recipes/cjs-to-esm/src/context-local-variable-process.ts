import type { SgRoot, Edit } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';

/**
 * @see https://github.com/nodejs/package-examples/blob/main/guide/05-cjs-esm-migration/migrating-context-local-variables/README.md
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	// __filename -> import.meta.filename
	const fileNameNods = rootNode.findAll({ rule: { pattern: '__filename' } });
	for (const node of fileNameNods) {
		edits.push(node.replace('import.meta.filename'));
	}

	// __dirname -> import.meta.dirname
	const dirNameNods = rootNode.findAll({ rule: { pattern: '__dirname' } });
	for (const node of dirNameNods) {
		edits.push(node.replace('import.meta.dirname'));
	}

	// require.main -> import.meta.main
	const requireMainNods = rootNode.findAll({
		rule: { pattern: 'require.main' },
	});
	for (const node of requireMainNods) {
		edits.push(node.replace('import.meta.main'));
	}

	// require.resolve(...) -> import.meta.resolve(...)
	const requireResolveNods = rootNode.findAll({
		rule: {
			kind: 'call_expression',
			has: {
				kind: 'member_expression',
				pattern: 'require.resolve',
			},
		},
	});
	for (const callExpr of requireResolveNods) {
		const argsNode = callExpr.field('arguments');

		if (argsNode) {
			const argTexts = argsNode.text();
			edits.push(callExpr.replace(`import.meta.resolve${argTexts}`));
		} else {
			edits.push(callExpr.replace('import.meta.resolve()'));
		}
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

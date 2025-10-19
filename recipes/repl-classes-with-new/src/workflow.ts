import { getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import type { SgRoot, Edit, SgNode } from '@codemod.com/jssg-types/main';
import type JS from "@codemod.com/jssg-types/langs/javascript";

/**
 * Classes of the repl module
 */
const CLASS_NAMES = [
	'REPLServer',
];

/**
 * Transform function that converts deprecated node:repl classes to use the `new` keyword
 *
 * Handles:
 * 1. `repl.REPLServer()` → `new repl.REPLServer()`
 * 2. Handles both CommonJS and ESM imports
 * 3. Preserves constructor arguments and assignments
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	const importNodes = getNodeImportStatements(root, 'repl');
	const requireNodes = getNodeRequireCalls(root, 'repl');
	const allStatementNodes = [...importNodes, ...requireNodes];
	const classes = new Set<string>(getReplClassBasePaths(allStatementNodes));

	for (const cls of classes) {
		const classesWithoutNew = rootNode.findAll({
			rule: {
				not: { follows: { pattern: 'new' } },
				pattern: `${cls}($$$ARGS)`,
			},
		});

		for (const clsWithoutNew of classesWithoutNew) {
			edits.push(clsWithoutNew.replace(`new ${clsWithoutNew.text()}`));
		}
	}

	if (edits.length === 0) return null;

	return rootNode.commitEdits(edits);
}

/**
 * Get the base path of the repl classes
 *
 * @param statements - The import & require statements to search for the repl classes
 * @returns The base path of the repl classes
 */
function* getReplClassBasePaths(statements: SgNode<JS>[]) {
	for (const cls of CLASS_NAMES) {
		for (const stmt of statements) {
			const resolvedPath = resolveBindingPath(stmt, `$.${cls}`);
			if (resolvedPath) {
				yield resolvedPath;
			}
		}
	}
}

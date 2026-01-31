import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import type { SgRoot, Edit, SgNode } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';

/**
 * Classes of the repl module
 */
const CLASS_NAMES = ['REPLServer', 'Recoverable'];

/**
 * Transform function that converts deprecated node:repl classes to use the `new` keyword
 *
 * Handles:
 * 1. `repl.REPLServer()` → `new repl.REPLServer()`
 * 2. `repl.Recoverable()` → `new repl.Recoverable()`
 * 3. Handles both CommonJS, ESM imports, and dynamic imports
 * 4. Preserves constructor arguments and assignments
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	const allStatementNodes = getModuleDependencies(root, 'repl');

	// if no imports are present it means that we don't need to process the file
	if (!allStatementNodes.length) return null;

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

	if (!edits.length) return null;

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

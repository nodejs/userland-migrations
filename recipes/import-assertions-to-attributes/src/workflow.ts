import { styleText } from 'node:util';
import { api } from '@codemod.com/workflow';
import type { Api } from '@codemod.com/workflow';
import type { Edit } from '@ast-grep/napi';
import type { SgNode } from '@ast-grep/napi';

// We run this codemod on all JS/TS files
// including CJS, MJS, TS, and JSX files.
const globPattern = '**/*.{cjs,mjs,js,jsx,?(d.)cts,?(d.)mts,?(d.)ts,tsx}';

/**
 * Utility function to log warnings with consistent formatting
 * @see https://github.com/nodejs/userland-migrations/pull/93
 */
function logWarning(message: string, filePath: string, nodeText: string) {
	console.warn(
		`${styleText(['bold', 'yellow'], '[Codemod: import-assertions-to-attributes]')}: ${message} in ${filePath}. Node: ${nodeText}`,
	);
}

/**
 * Utility function to find a child node by kind
 */
function findChildByKind(node: SgNode, kind: string): SgNode | undefined {
	return node.children().find(child => child.kind() === kind);
}

/**
 * Utility function to find the index of a child node by text content
 */
function findChildIndexByText(node: SgNode, text: string): number {
	return node.children().findIndex(child => child.text() === text);
}

/**
 * Handle import statements with assert syntax
 * e.g., `import { something } from './module.json' assert { type: 'json' };`
 */
function handleImportStatement(node: SgNode, contexts: Api['contexts']): Edit[] | undefined {
	const errorChild = findChildByKind(node, 'ERROR');

	if (!errorChild) {
		// If no ERROR child, skip this node as it might not contain assert
		return undefined;
	}

	// Check if the error child contains "assert" keyword
	const assertIndex = findChildIndexByText(errorChild, 'assert');

	if (assertIndex === -1) {
		const currentFile = contexts.getFileContext();
		logWarning(
			'Skipped modifying import attributes because no "assert" keyword was found in the import statement',
			currentFile.file,
			node.text()
		);
		return undefined;
	}

	const nextChild = errorChild.children()[assertIndex + 1];
	if (nextChild?.text().trim().startsWith('{')) {
		// Replace "assert" with "with"
		return [errorChild.children()[assertIndex].replace('with')];
	}

	return undefined;
}

/**
 * Process import statements with assert attributes
 *
 * Covers: `import { something } from './module.json' assert { type: 'json' };`
 *
 * We are searching for an ERROR child because the import assertions syntax
 * isn't correctly parsed by the parser, so we need to handle it manually.
 */
async function processImportStatements(astGrep: Api['astGrep'], contexts: Api['contexts']) {
	await astGrep({
		rule: {
			kind: 'import_statement',
			has: {
				kind: 'ERROR',
				inside: {
					kind: 'import_statement'
				}
			}
		},
	}).replace(({ getNode }) => {
		const node = getNode();
		const edits = handleImportStatement(node, contexts);

		return edits ? node.commitEdits(edits) : undefined;
	});
}

/**
 * Process dynamic import call expressions with assert attributes
 *
 * Covers: `import('./module.json', { assert: { type: 'json' } })`
 */
async function processCallExpressions(astGrep: Api['astGrep']) {
	await astGrep({
		rule: {
			kind: 'property_identifier',
			regex: '^assert$',
			inside: {
				kind: 'pair',
				inside: {
					kind: 'object',
					inside: {
						kind: 'arguments',
						inside: {
							kind: 'call_expression',
							pattern: "import($_SPECIFIER, $_ARGS)"
						}
					}
				}
			}
		},
	}).replace(() => 'with');
}

/**
 *
 * Goal of this codemod is to:
 * - Modify import attributes `assert` keywords to `with` or `value`
 *
 * @example
 * ```js
 * import { something } from './module.json' assert { type: 'json' };
 *
 * await import('./module.json', { assert: { type: 'json' } });
 * ```
 * becomes
 * ```js
 * import { something } from './module.json' with { type: 'json' };
 *
 * await import('./module.json', { with: { type: 'json' } });
 * ```
 *
 */
export async function workflow({ files, contexts }: Api) {
	console.log(
		`${styleText(["bold", "blue"], "[Codemod: import-assertions-to-attributes]")}: Modifying import attributes to use 'with' instead of 'assert'`,
	);

	const filesToProcess = await files(globPattern).astGrep;

	try {
		await processImportStatements(filesToProcess, contexts);
		await processCallExpressions(filesToProcess);
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(
			`${styleText(["bold", "red"], "[Codemod: import-assertions-to-attributes]")}: Error processing files - ${errorMessage}`,
		);
		throw error;
	}

	console.log(
		`${styleText(["bold", "blue"], "[Codemod:  import-assertions-to-attributes]")}: Finished modifying import attributes`,
	);
};

workflow(api);

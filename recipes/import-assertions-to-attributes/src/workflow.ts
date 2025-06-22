import { styleText } from 'node:util';
import { api } from '@codemod.com/workflow';
import type { Api } from '@codemod.com/workflow';
import type { Edit } from '@ast-grep/napi';

// We run this codemod on all JS/TS files
// including CJS, MJS, TS, and JSX files.
const globPattern = '**/*.{cjs,mjs,js,jsx,?(d.)cts,?(d.)mts,?(d.)ts,tsx}';

async function processModule(astGrep: Api['astGrep'], contexts: Api['contexts']) {
	await astGrep({
        rule: {
            any: [
				/**
				 * cover `import { something } from './module.json' assert { type: 'json' };`
				 *
				 * We are searching for an ERROR child
				 * because the import assertions syntax isn't correctly parsed
				 * by the parser, so we need to handle it manually.
				 */
				{
					kind: 'import_statement',
					has: {
						kind: 'ERROR',
						inside: {
							kind: 'import_statement'
						}
					}
				},
				// cover `import('./module.json', { assert: { type: 'json' } })`
				{
					kind: 'call_expression',
					pattern: "import($SPECIFIER, { assert: $ASSERT })",
				}
            ],
        },
    }).replace(({ getNode }) => {
		const node = getNode();
		const kind = node.kind();
		const edits: Array<Edit> = [];

		if (kind === 'import_statement') {
			// Modify import statement with assert
			const errorChild = node
				.children()
				.find( child => child.kind() === 'ERROR');

			if (!errorChild) {
				// If no ERROR child, skip this node as it might not contain assert
				return undefined;
			}

			// Check if the error child contains "assert" keyword
			const assertIndex = errorChild
				.children()
				.findIndex(child => child.text() === 'assert') + 1;

			if (assertIndex > 0) {
				const nextChild = errorChild.children()[assertIndex];
				if (nextChild?.text().trim().startsWith('{')) {
					// Replace "assert" with "with"
					edits.push(errorChild.children()[assertIndex - 1].replace('with'));
				}
			} else {
				const currentFile = contexts.getFileContext();

				console.warn(
					`${styleText(['bold', 'yellow'], '[Codemod: import-assertions-to-attributes]')}: Skipped modifying import attributes in ${currentFile.file} because no "assert" keyword was found in the import statement. Node: ${node.text()}`,
				);
				return undefined;
			}
		} else if (kind === 'call_expression') {
			// Modify dynamic import with assert
			const children = node.children();

			if (children.length > 2) {
				throw new Error(`Expected 2 children, got ${children.length}`);
			}

			const argumentsChildren = children[1].children();
			const argumentsObject = argumentsChildren.find(child => child.kind() === 'object');

			if (!argumentsObject) {
				throw new Error('Expected an object in the arguments of the call expression');
			}

			const assertPair = argumentsObject
				.children()
				.find(child => child.kind() === 'pair' && child.text().startsWith('assert'));

			if (!assertPair) {
				throw new Error('Expected an "assert" pair in the object of the call expression');
			}

			const assertValue = assertPair
				.children()
				.find(child => child.kind() === 'object');

			if (!assertValue) {
				throw new Error('Expected an object as the value of the "assert" pair');
			}

			// Replace "assert" with "with" and keep the same value
			const newTypePair = `with: ${assertValue.text()}`;
			edits.push(assertPair.replace(newTypePair));
		} else {
			throw new Error(`Unexpected node kind: ${node.kind}`);
		}

		return node.commitEdits(edits);
	});
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

	const filesToProcces = await files(globPattern).astGrep

	await processModule(filesToProcces, contexts)
		.catch(error => {
			console.error(
				`${styleText(["bold", "red"], "[Codemod: import-assertions-to-attributes]")}: Error processing files - ${error.message}`,
			);
			throw error;
		});

	console.log(
		`${styleText(["bold", "blue"], "[Codemod:  import-assertions-to-attributes]")}: Finished modifying import attributes`,
	);
};


workflow(api);

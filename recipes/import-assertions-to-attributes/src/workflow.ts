import type { SgRoot, Edit } from '@codemod.com/jssg-types/main';
import type JS from "@codemod.com/jssg-types/langs/javascript";

/**
 * Transform function that converts import assertions to import attributes
 *
 * Handles:
 * 1. import { something } from './module.json' assert { type: 'json' };
 * 2. import('./module.json', { assert: { type: 'json' } })
 *
 * Converts them to:
 * 1. import { something } from './module.json' with { type: 'json' };
 * 2. import('./module.json', { with: { type: 'json' } })
 */
export default async function transform(root: SgRoot<JS>): Promise<string> {
	const rootNode = root.root();
	const edits: Edit[] = [];

	const importStatements = rootNode.findAll({
		rule: {
			kind: 'import_attribute',
			regex: '^assert\\s*\\{',
		},
	});

	for (const importNode of importStatements) {
		// Replace 'assert' with 'with' in the import statement
		importNode.children().forEach((child) => {
			if (child.kind() === 'assert' && child.text() === 'assert') {
				//return child.replace('with');
				edits.push(child.replace('with'));
			}
		});
	}

	// Handle dynamic import call expressions with assert attributes
	// e.g., import('./module.json', { assert: { type: 'json' } })
	const assertIdentifiers = rootNode.findAll({
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
							pattern: 'import($_SPECIFIER, $_ARGS)',
						},
					},
				},
			},
		},
	});

	for (const assertNode of assertIdentifiers) {
		edits.push(assertNode.replace('with'));
	}

	return rootNode.commitEdits(edits);
}

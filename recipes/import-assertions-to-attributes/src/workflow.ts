import { useMetricAtom } from 'codemod:metrics';
import type { Codemod, Edit } from 'codemod:ast-grep';
import type JS from "codemod:ast-grep/langs/javascript";

const rewriteMetric = useMetricAtom('import-assert-to-with-rewrites');
const filesMetric = useMetricAtom('import-assert-to-with-files');

const transform: Codemod<JS> = async (root) => {
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
		const childrens = importNode.children();

		for (const child of childrens) {
			if (child.kind() === 'assert' && child.text() === 'assert') {
				edits.push(child.replace('with'));
				rewriteMetric.increment({ kind: 'static-import-attribute' });
			}
		}
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
		rewriteMetric.increment({ kind: 'dynamic-import-assert' });
	}

	filesMetric.increment({ status: edits.length ? 'migrated' : 'no-changes' });

	return rootNode.commitEdits(edits);
}

export default transform;

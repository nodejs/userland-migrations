import { useMetricAtom } from 'codemod:metrics';
import type { Codemod, SgRoot, SgNode, Edit, Range } from 'codemod:ast-grep';
import type Js from 'codemod:ast-grep/langs/javascript';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { updateBinding } from '@nodejs/codemod-utils/ast-grep/update-binding';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';

type Binding = {
	type: 'namespace' | 'destructured';
	binding: string;
	node: SgNode<Js>;
};

const bindingMetric = useMetricAtom('crypto-fips-bindings');
const usageMetric = useMetricAtom('crypto-fips-usages');
const filesMetric = useMetricAtom('crypto-fips-files');

/**
 * Collect all crypto.fips bindings from the file
 */
function collectCryptoFipsBindings(root: SgRoot<Js>): Binding[] {
	const bindings: Binding[] = [];
	const allStatements = getModuleDependencies(root, 'crypto');

	// If no statements found, skip transformation
	if (!allStatements.length) return bindings;

	for (const node of allStatements) {
		const resolvedPath = resolveBindingPath(node, '$.fips');

		if (!resolvedPath) continue;

		if (resolvedPath.includes('.')) {
			bindings.push({
				type: 'namespace',
				binding: resolvedPath.slice(0, resolvedPath.lastIndexOf('.')),
				node,
			});
		} else {
			bindings.push({
				type: 'destructured',
				binding: resolvedPath,
				node,
			});
		}
	}

	return bindings;
}

/**
 * Transform namespace usage: crypto.fips → crypto.getFips(), crypto.fips = val → crypto.setFips(val)
 */
function transformNamespaceUsage(rootNode: SgNode<Js>, base: string): Edit[] {
	const edits: Edit[] = [];

	const assignments = rootNode.findAll({
		rule: { pattern: `${base}.fips = $VALUE` },
	});

	for (const assignment of assignments) {
		const valueNode = assignment.getMatch('VALUE');
		if (valueNode) {
			let value = valueNode.text();
			value = value.replace(
				new RegExp(`\\b${base}\\.fips\\b`, 'g'),
				`${base}.getFips()`,
			);
			edits.push(assignment.replace(`${base}.setFips(${value})`));
			usageMetric.increment({ style: 'namespace', kind: 'write' });
		}
	}

	const reads = rootNode.findAll({
		rule: {
			pattern: `${base}.fips`,
			not: {
				inside: {
					kind: 'assignment_expression',
					has: {
						kind: 'member_expression',
						pattern: `${base}.fips`,
					},
				},
			},
		},
	});

	for (const read of reads) {
		edits.push(read.replace(`${base}.getFips()`));
		usageMetric.increment({ style: 'namespace', kind: 'read' });
	}

	return edits;
}

/**
 * Transform destructured usage: fips → getFips(), fips = val → setFips(val)
 */
function transformDestructuredUsage(
	rootNode: SgNode<Js>,
	binding: string,
): Edit[] {
	const edits: Edit[] = [];

	const assignments = rootNode.findAll({
		rule: {
			pattern: `${binding} = $VALUE`,
		},
	});

	for (const assignment of assignments) {
		const valueNode = assignment.getMatch('VALUE');
		if (valueNode) {
			let value = valueNode.text();
			value = value.replace(new RegExp(`\\b${binding}\\b`, 'g'), 'getFips()');
			edits.push(assignment.replace(`setFips(${value})`));
			usageMetric.increment({ style: 'destructured', kind: 'write' });
		}
	}

	const reads = rootNode.findAll({
		rule: {
			kind: 'identifier',
			pattern: binding,
			not: {
				inside: {
					any: [
						{
							kind: 'assignment_expression',
							has: {
								kind: 'identifier',
								pattern: binding,
							},
						},
						{ kind: 'import_statement' },
						{ kind: 'import_specifier' },
						{ kind: 'named_imports' },
						{ kind: 'object_pattern' },
						{ kind: 'pair_pattern' },
					],
				},
			},
		},
	});

	for (const read of reads) {
		edits.push(read.replace('getFips()'));
		usageMetric.increment({ style: 'destructured', kind: 'read' });
	}

	return edits;
}

/**
 * Transform function that converts deprecated crypto.fips calls
 * to the new crypto.getFips() and crypto.setFips() syntax.
 *
 * Handles:
 * 1. crypto.fips → crypto.getFips()
 * 2. crypto.fips = value → crypto.setFips(value)
 * 3. const { fips } = require("crypto") → const { getFips, setFips } = require("crypto")
 * 4. import { fips } from "crypto" → import { getFips, setFips } from "crypto")
 * 5. const { fips } = await import("crypto") → const { getFips, setFips } = await import("crypto")
 * 6. Aliased imports: { fips: alias } → { getFips, setFips }
 */
const transform: Codemod<Js> = async (root: SgRoot<Js>): Promise<string | null> => {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	const bindings = collectCryptoFipsBindings(root);

	if (bindings.length === 0) return null;

	for (const binding of bindings) {
		bindingMetric.increment({ type: binding.type });

		if (binding.type === 'namespace') {
			edits.push(...transformNamespaceUsage(rootNode, binding.binding));
		} else {
			edits.push(...transformDestructuredUsage(rootNode, binding.binding));

			const result = updateBinding(binding.node, {
				old: binding.binding,
				new: ['getFips', 'setFips'],
			});
			if (result?.edit) {
				edits.push(result.edit);
			}
			if (result?.lineToRemove) {
				linesToRemove.push(result.lineToRemove);
			}
		}
	}

	if (edits.length === 0 && linesToRemove.length === 0) {
		filesMetric.increment({ status: 'no-changes' });
		return null;
	}

	filesMetric.increment({ status: 'migrated' });

	const sourceCode = rootNode.commitEdits(edits);
	return linesToRemove.length > 0
		? removeLines(sourceCode, linesToRemove)
		: sourceCode;
}

export default transform;

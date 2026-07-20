import { useMetricAtom } from 'codemod:metrics';
import type { Codemod, Edit, SgNode } from 'codemod:ast-grep';
import type Js from 'codemod:ast-grep/langs/javascript';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { updateBinding } from '@nodejs/codemod-utils/ast-grep/update-binding';

const PATTERN_SET = ['F_OK', 'R_OK', 'W_OK', 'X_OK'];

export function isAccessModeConstant(name: string): boolean {
	return PATTERN_SET.includes(name);
}

type BindingMapping = {
	local: string;
	replacement: string;
};

type RemovedBinding = {
	imported: string;
	local: string;
};

const bindingMetric = useMetricAtom('fs-access-constants-bindings');
const namespaceMetric = useMetricAtom('fs-access-constants-namespace-rewrites');
const localMetric = useMetricAtom('fs-access-constants-local-rewrites');
const filesMetric = useMetricAtom('fs-access-constants-files');

function rewriteBindings(
	statement: SgNode<Js>,
	promisesBinding: string,
): { edits: Edit[]; mappings: BindingMapping[] } {
	const objectPattern = statement.find({
		rule: { kind: 'object_pattern' },
	});

	if (objectPattern) {
		return rewriteObjectPattern(statement, objectPattern, promisesBinding);
	}

	const namedImports = statement.find({
		rule: { kind: 'named_imports' },
	});

	if (namedImports) {
		return rewriteNamedImports(statement, namedImports, promisesBinding);
	}

	return { edits: [], mappings: [] };
}

function rewriteObjectPattern(
	statement: SgNode<Js>,
	pattern: SgNode<Js>,
	promisesBinding: string,
): { edits: Edit[]; mappings: BindingMapping[] } {
	const kept: string[] = [];
	const removed: RemovedBinding[] = [];

	const shorthandBindings = pattern
		.findAll({
			rule: { kind: 'shorthand_property_identifier_pattern' },
		})
		.map((node) => node.text());
	const aliasedBindings = pattern
		.findAll({
			rule: {
				kind: 'pair_pattern',
				has: {
					field: 'key',
					kind: 'property_identifier',
				},
			},
		})
		.map((pair) => {
			const imported = pair.field('key')?.text() ?? '';
			const local = pair.field('value')?.text() ?? imported;

			return {
				imported,
				local,
				text: pair.text(),
			};
		});

	for (const name of shorthandBindings) {
		if (isAccessModeConstant(name)) {
			removed.push({
				imported: name,
				local: name,
			});
			bindingMetric.increment({ shape: 'object-pattern', constant: name });
		} else {
			kept.push(name);
		}
	}

	for (const binding of aliasedBindings) {
		if (isAccessModeConstant(binding.imported)) {
			removed.push({
				imported: binding.imported,
				local: binding.local,
			});
			bindingMetric.increment({
				shape: 'object-pattern',
				constant: binding.imported,
			});
		} else {
			kept.push(binding.text);
		}
	}

	return rewriteCollectedBindings({
		statement,
		pattern,
		promisesBinding,
		kept,
		removed,
	});
}

export function rewriteNamedImports(
	statement: SgNode<Js>,
	pattern: SgNode<Js>,
	promisesBinding: string,
): { edits: Edit[]; mappings: BindingMapping[] } {
	const kept: string[] = [];
	const removed: RemovedBinding[] = [];

	const specifiers = pattern.findAll({
		rule: { kind: 'import_specifier' },
	});

	for (const specifier of specifiers) {
		const imported = specifier.field('name')?.text() ?? '';
		const local = specifier.field('alias')?.text() ?? imported;

		if (isAccessModeConstant(imported)) {
			removed.push({
				imported,
				local,
			});
			bindingMetric.increment({ shape: 'named-imports', constant: imported });
		} else {
			kept.push(specifier.text());
		}
	}

	return rewriteCollectedBindings({
		statement,
		pattern,
		promisesBinding,
		kept,
		removed,
	});
}

export function applyNamespaceReplacements(
	rootNode: SgNode<Js>,
	edits: Edit[],
	replacements: Map<string, string>,
): void {
	for (const [path, replacement] of replacements) {
		const nodes = rootNode.findAll({ rule: { pattern: path } });
		const constant = path.split('.').pop() ?? path;

		for (const node of nodes) {
			edits.push(node.replace(replacement));
			namespaceMetric.increment({ constant });
		}
	}
}

export function applyLocalReplacements(
	rootNode: SgNode<Js>,
	edits: Edit[],
	replacements: Map<string, string>,
): void {
	for (const [local, replacement] of replacements) {
		const identifiers = rootNode.findAll({
			rule: {
				kind: 'identifier',
				regex: `^${escapeRegExp(local)}$`,
			},
		});

		for (const identifier of identifiers) {
			if (
				identifier.inside({ rule: { kind: 'named_imports' } }) ||
				identifier.inside({ rule: { kind: 'object_pattern' } })
			) {
				continue;
			}

			edits.push(identifier.replace(replacement));
			localMetric.increment({ local });
		}
	}
}

export function rewriteCollectedBindings({
	statement,
	pattern,
	promisesBinding,
	kept,
	removed,
}: {
	statement: SgNode<Js>;
	pattern: SgNode<Js>;
	promisesBinding: string;
	kept: string[];
	removed: RemovedBinding[];
}): { edits: Edit[]; mappings: BindingMapping[] } {
	if (!removed.length) return { edits: [], mappings: [] };

	const replacementPrefix = promisesBinding
		? `${promisesBinding}.constants`
		: 'constants';
	const mappings = removed.map((binding) => ({
		local: binding.local,
		replacement: `${replacementPrefix}.${binding.imported}`,
	}));

	const shouldAddConstants = !promisesBinding && !kept.includes('constants');

	if (removed.length === 1) {
		const singleBindingEdit = updateBinding(statement, {
			old: removed[0].imported,
			new: shouldAddConstants ? 'constants' : undefined,
		}).edit;

		if (singleBindingEdit) return { edits: [singleBindingEdit], mappings };
	}

	if (shouldAddConstants) kept.push('constants');

	return {
		edits: [pattern.replace(`{ ${kept.join(', ')} }`)],
		mappings,
	};
}

export function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const transform: Codemod<Js> = async (root) => {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const localBindings = new Map<string, string>();
	const namespaceBindings = new Map<string, string>();

	const depStatements = getModuleDependencies(root, 'fs');

	if (!depStatements) return null;

	for (const statement of depStatements) {
		const promisesBinding = resolveBindingPath(statement, '$.promises');
		const rewritten = rewriteBindings(statement, promisesBinding);
		edits.push(...rewritten.edits);

		for (const mapping of rewritten.mappings) {
			localBindings.set(mapping.local, mapping.replacement);
		}

		for (const pattern of PATTERN_SET) {
			const resolved = resolveBindingPath(statement, `$.${pattern}`);
			if (!resolved?.includes('.') || resolved.includes('.constants.')) {
				continue;
			}

			namespaceBindings.set(
				resolved,
				resolved.replace(`.${pattern}`, `.constants.${pattern}`),
			);
		}
	}

	applyNamespaceReplacements(rootNode, edits, namespaceBindings);
	applyLocalReplacements(rootNode, edits, localBindings);

	if (!edits.length) {
		filesMetric.increment({ status: 'no-changes' });
		return null;
	}

	filesMetric.increment({ status: 'migrated' });

	return rootNode.commitEdits(edits);
}

export default transform;

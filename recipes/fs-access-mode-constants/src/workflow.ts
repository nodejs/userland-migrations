import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { updateBinding } from '@nodejs/codemod-utils/ast-grep/update-binding';
import type { Edit, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

const PATTERN_SET = new Set(['F_OK', 'R_OK', 'W_OK', 'X_OK']);

type BindingMapping = {
	local: string;
	replacement: string;
};

type RemovedBinding = {
	imported: string;
	local: string;
};

export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const localBindings = new Map<string, string>();
	const namespaceBindings = new Map<string, string>();

	const importStatements = getModuleDependencies(root, 'fs');

	if (!importStatements) return null;

	for (const statement of importStatements) {
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

	if (edits.length === 0) return null;

	return rootNode.commitEdits(edits);
}

function rewriteBindings(
	statement: SgNode<Js>,
	promisesBinding: string,
): { edits: Edit[]; mappings: BindingMapping[] } {
	const objectPattern = statement.find({
		rule: { kind: 'object_pattern' },
	});

	if (objectPattern)
		return rewriteObjectPattern(statement, objectPattern, promisesBinding);

	const namedImports = statement.find({
		rule: { kind: 'named_imports' },
	});

	if (namedImports)
		return rewriteNamedImports(statement, namedImports, promisesBinding);

	return { edits: [], mappings: [] };
}

function rewriteObjectPattern(
	statement: SgNode<Js>,
	pattern: SgNode<Js>,
	promisesBinding: string,
): { edits: Edit[]; mappings: BindingMapping[] } {
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

	const kept: string[] = [];
	const removed: RemovedBinding[] = [];
	let removedShorthandCount = 0;
	let removedAliasedCount = 0;

	for (const name of shorthandBindings) {
		if (PATTERN_SET.has(name)) {
			removedShorthandCount += 1;
			removed.push({
				imported: name,
				local: name,
			});
			continue;
		}

		kept.push(name);
	}

	for (const binding of aliasedBindings) {
		if (PATTERN_SET.has(binding.imported)) {
			removedAliasedCount += 1;
			removed.push({
				imported: binding.imported,
				local: binding.local,
			});
			continue;
		}

		kept.push(binding.text);
	}

	return rewriteCollectedBindings({
		statement,
		pattern,
		promisesBinding,
		kept,
		removed,
		allowSingleBindingOptimization:
			removedShorthandCount === 1 && removedAliasedCount === 0,
	});
}

function rewriteNamedImports(
	statement: SgNode<Js>,
	pattern: SgNode<Js>,
	promisesBinding: string,
): { edits: Edit[]; mappings: BindingMapping[] } {
	const specifiers = pattern.findAll({
		rule: { kind: 'import_specifier' },
	});

	const kept: string[] = [];
	const removed: RemovedBinding[] = [];

	for (const specifier of specifiers) {
		const imported = specifier.field('name')?.text() ?? '';
		const local = specifier.field('alias')?.text() ?? imported;

		if (PATTERN_SET.has(imported)) {
			removed.push({
				imported,
				local,
			});

			continue;
		}

		kept.push(specifier.text());
	}

	return rewriteCollectedBindings({
		statement,
		pattern,
		promisesBinding,
		kept,
		removed,
		allowSingleBindingOptimization:
			removed.length === 1 && removed[0].local === removed[0].imported,
	});
}

function applyNamespaceReplacements(
	rootNode: SgNode<Js>,
	edits: Edit[],
	replacements: Map<string, string>,
): void {
	for (const [path, replacement] of replacements) {
		const nodes = rootNode.findAll({ rule: { pattern: path } });

		for (const node of nodes) {
			edits.push(node.replace(replacement));
		}
	}
}

function applyLocalReplacements(
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
				!identifier.inside({ rule: { kind: 'named_imports' } }) ||
				!identifier.inside({ rule: { kind: 'object_pattern' } })
			) {
				edits.push(identifier.replace(replacement));
			}
		}
	}
}

function rewriteCollectedBindings({
	statement,
	pattern,
	promisesBinding,
	kept,
	removed,
	allowSingleBindingOptimization,
}: {
	statement: SgNode<Js>;
	pattern: SgNode<Js>;
	promisesBinding: string;
	kept: string[];
	removed: RemovedBinding[];
	allowSingleBindingOptimization: boolean;
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

	if (allowSingleBindingOptimization && removed.length === 1) {
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

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

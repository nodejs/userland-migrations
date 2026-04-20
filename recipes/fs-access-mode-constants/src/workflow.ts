import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { updateBinding } from '@nodejs/codemod-utils/ast-grep/update-binding';
import type { Edit, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

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

export default function transform(root: SgRoot<Js>): string | null {
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

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

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

		for (const node of nodes) {
			edits.push(node.replace(replacement));
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

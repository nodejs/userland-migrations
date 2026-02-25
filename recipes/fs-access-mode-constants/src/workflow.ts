import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { updateBinding } from '@nodejs/codemod-utils/ast-grep/update-binding';
import type { Edit, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

const PATTERNS = ['F_OK', 'R_OK', 'W_OK', 'X_OK'];

type BindingMapping = {
	local: string;
	replacement: string;
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

		for (const pattern of PATTERNS) {
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

	for (const [path, replacement] of namespaceBindings) {
		const nodes = rootNode.findAll({
			rule: { pattern: path },
		});

		for (const node of nodes) {
			edits.push(node.replace(replacement));
		}
	}

	for (const [local, replacement] of localBindings) {
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

	const removedShorthand = shorthandBindings.filter((name) =>
		PATTERNS.includes(name),
	);
	const removedAliased = aliasedBindings.filter((binding) =>
		PATTERNS.includes(binding.imported),
	);

	if (removedShorthand.length === 0 && removedAliased.length === 0) {
		return { edits: [], mappings: [] };
	}

	const mappings: BindingMapping[] = [];
	const replacementPrefix = promisesBinding
		? `${promisesBinding}.constants`
		: 'constants';

	for (const imported of removedShorthand) {
		mappings.push({
			local: imported,
			replacement: `${replacementPrefix}.${imported}`,
		});
	}

	for (const binding of removedAliased) {
		mappings.push({
			local: binding.local,
			replacement: `${replacementPrefix}.${binding.imported}`,
		});
	}

	const shouldAddConstants =
		!promisesBinding && !shorthandBindings.includes('constants');

	if (removedShorthand.length === 1 && removedAliased.length === 0) {
		const singleBindingEdit = getSingleBindingEdit(
			statement,
			removedShorthand[0],
			shouldAddConstants,
		);

		if (singleBindingEdit) {
			return { edits: [singleBindingEdit], mappings };
		}
	}

	const kept = [
		...shorthandBindings.filter((name) => !PATTERNS.includes(name)),
		...aliasedBindings
			.filter((binding) => !PATTERNS.includes(binding.imported))
			.map((binding) => binding.text),
	];

	if (!promisesBinding && !kept.includes('constants')) {
		kept.push('constants');
	}

	return {
		edits: [pattern.replace(`{ ${kept.join(', ')} }`)],
		mappings,
	};
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
	const mappings: BindingMapping[] = [];
	const removedUnaliased: string[] = [];
	const removedAliased: string[] = [];
	const replacementPrefix = promisesBinding
		? `${promisesBinding}.constants`
		: 'constants';

	for (const specifier of specifiers) {
		const imported = specifier.field('name')?.text() ?? '';
		const local = specifier.field('alias')?.text() ?? imported;

		if (PATTERNS.includes(imported)) {
			mappings.push({
				local,
				replacement: `${replacementPrefix}.${imported}`,
			});

			if (local === imported) {
				removedUnaliased.push(imported);
			} else {
				removedAliased.push(local);
			}

			continue;
		}

		kept.push(specifier.text());
	}

	if (!mappings.length) return { edits: [], mappings: [] };

	const shouldAddConstants = !promisesBinding && !kept.includes('constants');

	if (removedUnaliased.length === 1 && removedAliased.length === 0) {
		const singleBindingEdit = getSingleBindingEdit(
			statement,
			removedUnaliased[0],
			shouldAddConstants,
		);

		if (singleBindingEdit) {
			return { edits: [singleBindingEdit], mappings };
		}
	}

	if (!promisesBinding && !kept.includes('constants')) {
		kept.push('constants');
	}

	return {
		edits: [pattern.replace(`{ ${kept.join(', ')} }`)],
		mappings,
	};
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSingleBindingEdit(
	statement: SgNode<Js>,
	oldBinding: string,
	shouldAddConstants: boolean,
): Edit | null {
	const update = updateBinding(statement, {
		old: oldBinding,
		new: shouldAddConstants ? 'constants' : undefined,
	});

	if (update?.edit) {
		return update.edit;
	}

	if (update?.lineToRemove) {
		return statement.replace('');
	}

	return null;
}

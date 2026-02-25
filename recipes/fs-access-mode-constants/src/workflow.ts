import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import type { Edit, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

const PATTERNS = ['F_OK', 'R_OK', 'W_OK', 'X_OK'];

export default function tranform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const replacementMap = new Map<string, string>();

	const requireStatements = getNodeRequireCalls(root, 'fs');

	for (const statement of requireStatements) {
		const objectPattern = statement.find({
			rule: { kind: 'object_pattern' },
		});

		if (objectPattern) {
			const promisesBinding = getLocalPromisesBinding(statement);
			let objPatArr = objectPattern
				.findAll({
					rule: { kind: 'shorthand_property_identifier_pattern' },
				})
				.map((v) => v.text());

			const removedBindings = objPatArr.filter((v) => PATTERNS.includes(v));
			if (removedBindings.length > 0) {
				for (const binding of removedBindings) {
					if (promisesBinding) {
						replacementMap.set(
							binding,
							`${promisesBinding}.constants.${binding}`,
						);
					} else {
						replacementMap.set(binding, `constants.${binding}`);
					}
				}

				objPatArr = objPatArr.filter((v) => !PATTERNS.includes(v));
				if (!promisesBinding && !objPatArr.includes('constants')) {
					objPatArr.push('constants');
				}
				edits.push(objectPattern.replace(`{ ${objPatArr.join(', ')} }`));
			}
		}
	}

	const importStatements = getNodeImportStatements(root, 'fs');

	for (const statement of importStatements) {
		const promisesBinding = getLocalPromisesBinding(statement);
		const objectPattern = statement.find({
			rule: { kind: 'named_imports' },
		});

		if (objectPattern) {
			const specifiers = objectPattern.findAll({
				rule: { kind: 'import_specifier' },
			});

			const filteredImports: string[] = [];
			let removedAny = false;

			for (const specifier of specifiers) {
				const importedName = specifier.field('name')?.text() ?? '';
				const localName = specifier.field('alias')?.text() ?? importedName;

				if (PATTERNS.includes(importedName)) {
					removedAny = true;
					const replacementPrefix = promisesBinding
						? `${promisesBinding}.constants`
						: 'constants';
					replacementMap.set(localName, `${replacementPrefix}.${importedName}`);
					continue;
				}

				filteredImports.push(specifier.text());
			}

			if (removedAny) {
				if (!promisesBinding && !filteredImports.includes('constants')) {
					filteredImports.push('constants');
				}
				edits.push(objectPattern.replace(`{ ${filteredImports.join(', ')} }`));
			}
		}
	}

	for (const statement of [...requireStatements, ...importStatements]) {
		for (const _OK of PATTERNS) {
			const local = resolveBindingPath(statement, `$.${_OK}`);
			if (!local?.includes('.') || local.includes('.constants.')) {
				continue;
			}

			replacementMap.set(local, local.replace(`.${_OK}`, `.constants.${_OK}`));
		}
	}

	for (const [local, replacement] of replacementMap) {
		if (local.includes('.')) {
			const nodes = rootNode.findAll({
				rule: { pattern: local },
			});
			for (const node of nodes) {
				edits.push(node.replace(replacement));
			}
			continue;
		}

		const refs = rootNode.findAll({
			rule: {
				kind: 'identifier',
				regex: `^${escapeRegExp(local)}$`,
			},
		});

		for (const ref of refs) {
			if (
				ref.inside({ rule: { kind: 'named_imports' } }) ||
				ref.inside({ rule: { kind: 'object_pattern' } })
			) {
				continue;
			}
			edits.push(ref.replace(replacement));
		}
	}

	return rootNode.commitEdits(edits);
}

function getLocalPromisesBinding(statement: SgNode<Js>): string {
	const resolved = resolveBindingPath(statement, '$.promises');
	if (!resolved || resolved.includes('.')) {
		return '';
	}

	return resolved;
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

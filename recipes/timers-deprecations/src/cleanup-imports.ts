import { getDefaultImportIdentifier } from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getRequireNamespaceIdentifier } from '@nodejs/codemod-utils/ast-grep/require-call';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { removeBinding } from '@nodejs/codemod-utils/ast-grep/remove-binding';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import type { Edit, Range, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

const DEPRECATED_METHODS = ['enroll', 'unenroll', 'active', '_unrefActive'];

export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	const importNodes = getModuleDependencies(root, 'timers');

	for (const statement of importNodes) {
		if (statement.is('expression_statement')) continue;
		if (shouldRemoveEntireStatement(statement)) {
			linesToRemove.push(statement.range());
			continue;
		}

		let statementMarkedForRemoval = false;
		const removedBindings = new Set<string>();

		for (const method of DEPRECATED_METHODS) {
			const bindingPath = resolveBindingPath(statement, `$.${method}`);
			if (!bindingPath) continue;

			const localBinding = bindingPath.split('.').at(-1);
			if (!localBinding || removedBindings.has(localBinding)) continue;

			if (isBindingStillUsed(rootNode, statement, localBinding)) continue;

			const removal = removeBinding(statement, localBinding);
			if (!removal) continue;

			if (removal.edit) edits.push(removal.edit);
			if (removal.lineToRemove) {
				linesToRemove.push(removal.lineToRemove);
				removedBindings.add(localBinding);
				statementMarkedForRemoval = true;
				break;
			}

			removedBindings.add(localBinding);
		}

		if (statementMarkedForRemoval) continue;

		const namespaceIdentifier = getNamespaceIdentifier(statement);
		if (!namespaceIdentifier) continue;

		const nsName = namespaceIdentifier.text();
		if (removedBindings.has(nsName)) continue;
		if (isBindingStillUsed(rootNode, statement, nsName)) continue;

		const removal = removeBinding(statement, nsName);
		if (!removal) continue;

		if (removal.edit) edits.push(removal.edit);
		if (removal.lineToRemove) linesToRemove.push(removal.lineToRemove);
	}

	if (!edits.length && !linesToRemove.length) {
		return null;
	}

	let source = edits.length ? rootNode.commitEdits(edits) : rootNode.text();

	if (linesToRemove.length) {
		source = removeLines(source, linesToRemove);
	}

	return source;
}

function isBindingStillUsed(
	rootNode: SgNode<Js>,
	statement: SgNode<Js>,
	binding: string,
): boolean {
	const occurrences = rootNode.findAll({ rule: { pattern: binding } });
	for (const occurrence of occurrences) {
		if (isInsideNode(occurrence, statement)) continue;
		return true;
	}
	return false;
}

function isInsideNode(node: SgNode<Js>, container: SgNode<Js>): boolean {
	for (const ancestor of node.ancestors()) {
		if (ancestor.id() === container.id()) return true;
	}
	return false;
}

function getNamespaceIdentifier(statement: SgNode<Js>): SgNode<Js> | null {
	const requireIdent = getRequireNamespaceIdentifier(statement);
	if (requireIdent) return requireIdent;

	const namespaceImport = statement.find({
		rule: {
			kind: 'identifier',
			inside: { kind: 'namespace_import' },
		},
	});
	if (namespaceImport) return namespaceImport;

	const dynamicImportIdentifier = statement.find({
		rule: {
			kind: 'identifier',
			inside: { kind: 'variable_declarator' },
			not: { inside: { kind: 'object_pattern' } },
		},
	});
	if (dynamicImportIdentifier) return dynamicImportIdentifier;

	return getDefaultImportIdentifier(statement);
}

function shouldRemoveEntireStatement(statement: SgNode<Js>): boolean {
	const supportedMethods = statement.findAll({
		constraints: {
			METHOD: {
				regex: `^(${DEPRECATED_METHODS.join('|')})$`,
			},
		},
		rule: {
			any: [
				{
					inside: {
						kind: 'object_pattern',
					},
					kind: 'shorthand_property_identifier_pattern',
					pattern: '$METHOD',
				},
				{
					inside: {
						kind: 'pair_pattern',
						inside: {
							kind: 'object_pattern',
						},
					},
					kind: 'property_identifier',
					pattern: '$METHOD',
				},
				{
					inside: {
						kind: 'import_specifier',
						inside: {
							kind: 'named_imports',
						},
					},
					kind: 'identifier',
					pattern: '$METHOD',
				},
			],
		},
	});
	return Boolean(supportedMethods.length);
}

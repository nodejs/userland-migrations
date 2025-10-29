import {
	getNodeImportStatements,
	getDefaultImportIdentifier,
} from '@nodejs/codemod-utils/ast-grep/import-statement';
import {
	getNodeRequireCalls,
	getRequireNamespaceIdentifier,
} from '@nodejs/codemod-utils/ast-grep/require-call';
import { removeBinding } from '@nodejs/codemod-utils/ast-grep/remove-binding';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import type { Edit, Range, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

const DEPRECATED_METHODS = [
	'enroll',
	'unenroll',
	'active',
	'_unrefActive',
] as const;
const DEPRECATED_SET = new Set<string>(DEPRECATED_METHODS);

export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	const statements = [
		...getNodeRequireCalls(root, 'timers'),
		...getNodeImportStatements(root, 'timers'),
	];

	for (const statement of statements) {
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

		if (statementMarkedForRemoval) {
			continue;
		}

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

	return source.replace(/^\s*\n/, '');
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

	return getDefaultImportIdentifier(statement);
}

function shouldRemoveEntireStatement(statement: SgNode<Js>): boolean {
	const objectPattern = statement.find({ rule: { kind: 'object_pattern' } });
	if (objectPattern) {
		const propertyNames = new Set<string>();
		for (const shorthand of objectPattern.findAll({
			rule: { kind: 'shorthand_property_identifier_pattern' },
		})) {
			propertyNames.add(shorthand.text());
		}
		for (const pair of objectPattern.findAll({ rule: { kind: 'pair_pattern' } })) {
			const property = pair.find({ rule: { kind: 'property_identifier' } });
			if (!property) return false;
			propertyNames.add(property.text());
		}
		if (!propertyNames.size) return false;
		for (const name of propertyNames) {
			if (!DEPRECATED_SET.has(name)) return false;
		}
		return true;
	}

	const namedImports = statement.find({ rule: { kind: 'named_imports' } });
	if (!namedImports) return false;

	const importClause = statement.find({ rule: { kind: 'import_clause' } });
	if (!importClause) return false;

	if (importClause.find({ rule: { kind: 'namespace_import' } })) return false;

	const defaultImport = importClause.find({
		rule: {
			kind: 'identifier',
			not: { inside: { kind: 'named_imports' } },
		},
	});
	if (defaultImport) return false;

	let hasSpecifier = false;
	for (const specifier of namedImports.findAll({ rule: { kind: 'import_specifier' } })) {
		hasSpecifier = true;
		const identifiers = specifier.findAll({ rule: { kind: 'identifier' } });
		if (!identifiers.length) return false;
		const importedName = identifiers[0]?.text();
		if (!importedName || !DEPRECATED_SET.has(importedName)) return false;
	}

	return hasSpecifier;
}

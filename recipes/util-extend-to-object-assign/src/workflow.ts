import {
	getDefaultImportIdentifier,
} from '@nodejs/codemod-utils/ast-grep/import-statement';
import {
	getRequireNamespaceIdentifier,
} from '@nodejs/codemod-utils/ast-grep/require-call';
import { removeBinding } from '@nodejs/codemod-utils/ast-grep/remove-binding';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import type { SgRoot, Edit, Range } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';

const method = '_extend';

/**
 * Transform function that converts deprecated util._extend() calls
 * to Object.assign().
 *
 * Handles:
 * 1. util._extend(target, source) → Object.assign(target, source)
 * 2. const { _extend } = require('util'); _extend(target, source) → Object.assign(target, source)
 * 3. import { _extend } from 'node:util'; _extend(target, source) → Object.assign(target, source)
 * 4. Aliased imports: const { _extend: extend } = require('util'); extend(target, source) → Object.assign(target, source)
 *
 * Also cleans up unused imports and requires.
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];
	const editRanges: Range[] = [];

	const importOrRequireNodes = getModuleDependencies(root, 'util')

	// If no util imports/requires, nothing to do
	if (!importOrRequireNodes.length) return null;

	// 1. Resolve local bindings for util._extend and replace invocations
	const localRefs = new Set<string>();

	for (const node of importOrRequireNodes) {
		const resolved = resolveBindingPath(node, `$.${method}`);
		if (resolved) localRefs.add(resolved);

		// Workaround for mixed imports (e.g. import util, { _extend } from 'util')
		if (node.kind() === 'import_statement') {
			const namedSpecifiers = node.findAll({
				rule: {
					kind: 'import_specifier',
				},
			});

			for (const specifier of namedSpecifiers) {
				const nameNode = specifier.field('name');
				const aliasNode = specifier.field('alias');

				if (nameNode && nameNode.text() === method) {
					const localName = aliasNode ? aliasNode.text() : nameNode.text();
					localRefs.add(localName);
				}
			}
		}
	}

	for (const ref of localRefs) {
		const calls = rootNode.findAll({
			rule: {
				kind: 'call_expression',
				pattern: `${ref}($$$ARGS)`,
			},
		});

		for (const call of calls) {
			const args = call.find({
				rule: { kind: 'arguments' },
			});

			edits.push(call.replace(`Object.assign${args.text()}`));
			editRanges.push(call.range());
		}
	}

	// if no edits were made, don't try to clean up imports
	if (!edits.length) return null;

	// 2. Cleanup imports
	for (const node of importOrRequireNodes) {
		let nsBinding = '';

		const reqNs = getRequireNamespaceIdentifier(node);
		const defaultImport = getDefaultImportIdentifier(node);
		const namespaceImport = node.find({
			rule: {
				kind: 'identifier',
				inside: {
					kind: 'namespace_import',
				},
			},
		});

		if (reqNs) {
			nsBinding = reqNs.text();
		} else if (defaultImport) {
			nsBinding = defaultImport.text();
		} else if (namespaceImport) {
			nsBinding = namespaceImport.text();
		}

		// Check if namespace binding is still used
		if (nsBinding) {
			const change = removeBinding(node, nsBinding, {
				usageCheck: { ignoredRanges: editRanges },
				root: rootNode,
			});
			if (change?.lineToRemove) linesToRemove.push(change.lineToRemove);
		}

		const change = removeBinding(node, method);
		if (change?.edit) edits.push(change.edit);
		if (change?.lineToRemove) linesToRemove.push(change.lineToRemove);
	}

	const sourceCode = rootNode.commitEdits(edits);

	return removeLines(sourceCode, linesToRemove);
}

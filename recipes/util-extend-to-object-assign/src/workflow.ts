import {
	getNodeImportStatements,
	getNodeImportCalls,
	getDefaultImportIdentifier,
	getNamespaceImportIdentifier,
} from '@nodejs/codemod-utils/ast-grep/import-statement';
import {
	getNodeRequireCalls,
	getRequireNamespaceIdentifier,
} from '@nodejs/codemod-utils/ast-grep/require-call';
import { removeBinding } from '@nodejs/codemod-utils/ast-grep/remove-binding';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import { isBindingUsed } from '@nodejs/codemod-utils/ast-grep/is-binding-used';
import type { SgRoot, Edit, Range } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';

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

	const importOrRequireNodes = [
		...getNodeRequireCalls(root, 'util'),
		...getNodeImportStatements(root, 'util'),
		...getNodeImportCalls(root, 'util'),
	];

	// If no util imports/requires, nothing to do
	if (!importOrRequireNodes.length) return null;

	// 1. Resolve local bindings for util._extend and replace invocations
	const localRefs = new Set<string>();

	for (const node of importOrRequireNodes) {
		const resolved = resolveBindingPath(node, `$.${method}`);
		if (resolved) localRefs.add(resolved);
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

			// Replace with Object.assign
			edits.push(call.replace(`Object.assign${args.text()}`));
		}
	}

	// if no edits were made, don't try to clean up imports
	if (!edits.length) return null;

	// 2. Cleanup imports
	for (const node of importOrRequireNodes) {
		let nsBinding = '';

		const reqNs = getRequireNamespaceIdentifier(node);
		const defaultImport = getDefaultImportIdentifier(node);
		const namespaceImport = getNamespaceImportIdentifier(node);

		if (reqNs) nsBinding = reqNs.text();
		else if (defaultImport) nsBinding = defaultImport.text();
		else if (namespaceImport) nsBinding = namespaceImport.text();

		if (nsBinding && !isBindingUsed(root, nsBinding, node, [method])) {
			// If no other usages, we can remove the import line
			linesToRemove.push(node.range());
			continue; // Skip removeBinding for this node as we removed the whole line
		}

		// If we didn't remove the whole line, try to remove the specific binding `_extend`
		// This works for destructuring: `const { _extend } = require('util')`
		const change = removeBinding(node, method);
		if (change?.edit) edits.push(change.edit);
		if (change?.lineToRemove) linesToRemove.push(change.lineToRemove);
	}

	const sourceCode = rootNode.commitEdits(edits);

	return removeLines(sourceCode, linesToRemove);
}

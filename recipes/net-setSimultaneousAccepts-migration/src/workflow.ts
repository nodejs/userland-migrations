import {
	getNodeImportStatements,
	getNodeImportCalls,
} from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import type { SgRoot, Edit, Range } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

/**
 * Transform function that removes deprecated net._setSimultaneousAccepts() calls
 *
 * Handles:
 * 1. net._setSimultaneousAccepts(true) → removed
 * 2. net._setSimultaneousAccepts(false) → removed
 * 3. Works with both CommonJS (require) and ESM (import) syntax
 * 4. Handles aliased imports/requires
 *
 * Note: This was an internal API (DEP0121) that reached End-of-Life in Node.js v24.0.0
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	// Collect all 'node:net' module imports/requires
	const allStatements = [
		...getNodeImportStatements(root, 'node:net'),
		...getNodeImportCalls(root, 'node:net'),
		...getNodeRequireCalls(root, 'node:net'),
	];

	// If no net module statements found, skip transformation
	if (allStatements.length === 0) return null;

	for (const statementNode of allStatements) {
		// Resolve the binding path for the net module
		const bindingPath = resolveBindingPath(statementNode, '$');
		
		if (!bindingPath) continue;

		// Find all calls to _setSimultaneousAccepts on the resolved binding
		const callExpressions = rootNode.findAll({
			rule: {
				pattern: `${bindingPath}._setSimultaneousAccepts($$$ARGS)`,
			},
		});

		for (const callNode of callExpressions) {
			// Find the parent statement (expression_statement) to remove the entire line
			let parentStatement = callNode.parent();
			
			// Traverse up to find the expression_statement
			while (parentStatement && parentStatement.kind() !== 'expression_statement') {
				parentStatement = parentStatement.parent();
			}

			if (parentStatement) {
				// Get the range of the entire statement including semicolon
				const range = parentStatement.range();
				linesToRemove.push(range);
			} else {
				// Fallback: just remove the call itself if we can't find the statement
				edits.push(callNode.replace(''));
			}
		}
	}

	// If no changes were made, return null
	if (edits.length === 0 && linesToRemove.length === 0) return null;

	// Apply edits first if any
	const sourceCode = edits.length > 0 
		? rootNode.commitEdits(edits) 
		: rootNode.text();

	// Then remove the lines
	return linesToRemove.length > 0
		? removeLines(sourceCode, linesToRemove)
		: sourceCode;
}
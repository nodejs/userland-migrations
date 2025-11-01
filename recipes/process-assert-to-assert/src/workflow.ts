import { EOL } from 'node:os';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { removeBinding } from '@nodejs/codemod-utils/ast-grep/remove-binding';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import type {
	Edit,
	Range,
	Rule,
	SgNode,
	SgRoot,
} from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';

type ReplaceRule = {
	importNode?: SgNode<JS>;
	binding?: string;
	rule: Rule<JS>;
	replaceWith?: string;
};

/**
 * Transform function that converts deprecated `process.assert` usage to the `node:assert` module.
 *
 * Handles:
 * 1. Replaces `process.assert(...)` member expressions/calls with `assert(...)` or `assert.xxx` as appropriate.
 * 2. Handles cases where `process` is imported/required under a different binding (resolves binding paths).
 * 3. Removes the original `process` import/require when it's only used for `assert` and removes the import line when empty.
 * 4. Adds `import assert from "node:assert";` or `const assert = require("node:assert");` at the top
 *    when the file does not already import/require `assert`.
 *
 * Steps:
 * - Find all `process` import/require statements and resolve any binding for `assert`.
 * - Replace call and member-expression usages that reference `process.assert` (or the resolved binding) with `assert`.
 * - Remove or update the original import/require for `process` when it's no longer needed.
 * - If `assert` is not already present, insert the appropriate `import` or `require` line depending on the module style.
 *
 * @param root - The AST root node provided by jssg for the file being transformed.
 * @returns The transformed source code as a string, or `null` when no edits are required.
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];
	const replaceRules: ReplaceRule[] = [
		{
			rule: {
				kind: 'member_expression',
				pattern: 'process.assert',
			},
			replaceWith: 'assert',
		},
	];

	const processImportsToRemove = new Set<SgNode<JS>>();

	const requireCalls = getNodeRequireCalls(root, 'process');
	const importStatements = getNodeImportStatements(root, 'process');
	const allImports = [...requireCalls, ...importStatements];
	const processUsages = rootNode.findAll({
		rule: {
			kind: 'member_expression',
			has: {
				kind: 'identifier',
				regex: '^process$',
			},
		},
	});

	for (const processImport of allImports) {
		const binding = resolveBindingPath(processImport, '$.assert');

		replaceRules.push({
			importNode: processImport,
			binding,
			rule: {
				kind: 'identifier',
				regex: binding,
				inside: {
					kind: 'call_expression',
				},
			},
			replaceWith: 'assert',
		});

		if (binding) {
			replaceRules.push({
				importNode: processImport,
				binding,
				rule: {
					kind: 'member_expression',
					has: {
						kind: 'identifier',
						regex: `^${binding}$`,
						field: 'object',
					},
				},
				replaceWith: 'assert',
			});
		}

		let hasNonAssertUsage = false;
		for (const usage of processUsages) {
			const propertyNode = usage.field('property');
			if (propertyNode && propertyNode.text() !== 'assert') {
				hasNonAssertUsage = true;
				break;
			}
		}

		if (!hasNonAssertUsage && processUsages.length > 0) {
			processImportsToRemove.add(processImport);
			linesToRemove.push(processImport.range());
		}
	}

	for (const replaceRule of replaceRules) {
		const nodes = rootNode.findAll({
			rule: replaceRule.rule,
		});

		for (const node of nodes) {
			if (replaceRule.importNode) {
				if (!processImportsToRemove.has(replaceRule.importNode)) {
					const removeBind = removeBinding(
						replaceRule.importNode,
						replaceRule.binding,
					);

					if (removeBind.edit) {
						edits.push(removeBind.edit);
					}

					if (removeBind.lineToRemove) {
						linesToRemove.push(removeBind.lineToRemove);
					}
				}
			}

			if (
				replaceRule.rule.kind === 'member_expression' &&
				replaceRule.binding
			) {
				const objectNode = node.field('object');
				if (objectNode) {
					edits.push(objectNode.replace('assert'));
				}
			} else {
				const replaceText = replaceRule.replaceWith || 'assert';
				edits.push(node.replace(replaceText));
			}
		}
	}

	let sourceCode = rootNode.commitEdits(edits);

	sourceCode = removeLines(sourceCode, linesToRemove);

	if (edits.length === 0 && linesToRemove) return sourceCode;

	const alreadyRequiringAssert = getNodeRequireCalls(root, 'assert');
	const alreadyImportingAssert = getNodeImportStatements(root, 'assert');

	if (alreadyRequiringAssert.length && alreadyImportingAssert.length)
		return sourceCode;

	const usingRequire = rootNode.find({
		rule: {
			kind: 'call_expression',
			has: {
				kind: 'identifier',
				field: 'function',
				regex: 'require',
			},
		},
	});
	const usingImport = rootNode.find({
		rule: {
			kind: 'import_statement',
		},
	});

	const isCjsFile = root.filename().endsWith('.cjs');
	const isMjsFile = root.filename().endsWith('.mjs');

	if (usingRequire || isCjsFile) {
		return `const assert = require("node:assert");${EOL}${sourceCode}`;
	}

	if (usingImport || isMjsFile) {
		return `import assert from "node:assert";${EOL}${sourceCode}`;
	}

	// @todo(AugustinMauroy): after codemod response of capabilities on workflow step
	// enable fs to read package.json to determine module type
	console.warn(
		`[process-assert-to-assert] Unable to determine module type for file: ${root.filename()}. No import added.`,
	);

	return `// Unable to determine module type; please add the appropriate import for 'assert'${EOL}${sourceCode}`;
}

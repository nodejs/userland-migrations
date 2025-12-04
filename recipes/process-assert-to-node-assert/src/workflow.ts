import { EOL } from 'node:os';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
				pattern: 'process',
			},
		},
	});

	for (const processImport of allImports) {
		const binding = resolveBindingPath(processImport, '$.assert');

		if (binding) {
			// Handle member expressions like nodeAssert.strictEqual
			replaceRules.push({
				importNode: processImport,
				binding,
				rule: {
					kind: 'member_expression',
					has: {
						kind: binding.includes('.') ? 'member_expression' : 'identifier',
						pattern: binding,
					},
				},
				replaceWith: 'assert',
			});

			// Handle standalone calls like nodeAssert(...)
			replaceRules.push({
				importNode: processImport,
				binding,
				rule: {
					kind: 'call_expression',
					has: {
						kind: 'identifier',
						field: 'function',
						pattern: binding,
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

	const processedImports = new Set<SgNode<JS>>();

	for (const replaceRule of replaceRules) {
		const nodes = rootNode.findAll({
			rule: replaceRule.rule,
		});

		for (const node of nodes) {
			if (
				replaceRule.importNode &&
				!processedImports.has(replaceRule.importNode)
			) {
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
				processedImports.add(replaceRule.importNode);
			}

			if (
				replaceRule.rule.kind === 'member_expression' &&
				replaceRule.binding
			) {
				// Replace the object part of member expressions (e.g., nodeAssert.strictEqual -> assert.strictEqual)
				const objectNode = node.field('object');

				if (objectNode) {
					edits.push(objectNode.replace('assert'));
				}
			} else if (
				replaceRule.rule.kind === 'call_expression' &&
				replaceRule.binding
			) {
				// Replace the function identifier in call expressions (e.g., nodeAssert(...) -> assert(...))
				const functionNode = node.field('function');

				if (functionNode) {
					edits.push(functionNode.replace('assert'));
				}
			} else {
				const replaceText = replaceRule.replaceWith || 'assert';
				edits.push(node.replace(replaceText));
			}
		}
	}

	const sourceCode = removeLines(
	  rootNode.commitEdits(edits),
	  linesToRemove,
	);

	if (edits.length === 0 && linesToRemove) return sourceCode;

	const alreadyRequiringAssert = getNodeRequireCalls(root, 'assert');
	const alreadyImportingAssert = getNodeImportStatements(root, 'assert');

	if (alreadyRequiringAssert.length || alreadyImportingAssert.length)
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
	const filename = root.filename();
	const isCjsFile = filename.endsWith('.cjs');
	const isMjsFile = filename.endsWith('.mjs');

	// Prefer adding an ES module import when the file already uses ESM syntax
	// (contains `import` statements) or is an `.mjs` file. This avoids injecting a
	// CommonJS `require` into an ES module source (even if the file references
	// `createRequire`).
	if (usingImport || isMjsFile) {
		return `import assert from "node:assert";${EOL}${sourceCode}`;
	}

	if (usingRequire || isCjsFile) {
		return `const assert = require("node:assert");${EOL}${sourceCode}`;
	}

	const packageJsonPath = join(process.cwd(), 'package.json');
	const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
	const isEsm = packageJson.type === 'module';

	if (isEsm) {
		return `import assert from "node:assert";${EOL}${sourceCode}`;
	}

	return `const assert = require("node:assert");${EOL}${sourceCode}`;
}

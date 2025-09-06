import type { Edit, Range, Rule, SgNode, SgRoot } from "@codemod.com/jssg-types/main";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";
import { removeBinding } from "@nodejs/codemod-utils/ast-grep/remove-binding";
import { removeLines } from "@nodejs/codemod-utils/ast-grep/remove-lines";

/**
 * Transforms deprecated `process.assert` usage to the standard `assert` module.
 * 
 * Transformations:
 * 1. Replaces all `process.assert` references with `assert`
 * 2. Adds the necessary import/require statement if not already present:
 *    - For ESM or files without require calls: adds `import assert from "node:assert"`
 *    - For CommonJS (.cjs files or files using require): adds `const assert = require("node:assert")`
 * 
 * Examples:
 * 
 * Before:
 * ```js
 * process.assert(value);
 * process.assert.strictEqual(a, b);
 * ```
 * 
 * After:
 * ```js
 * import assert from "node:assert";
 * assert(value);
 * assert.strictEqual(a, b);
 * ```
 */
export default function transform(root: SgRoot): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];
	const replaceRules: Array<
		{
			importNode?: SgNode
			binding?: string
			rule: Rule
		}
	> = [{
		rule: {
			kind: 'member_expression',
			pattern: "process.assert",
		}
	}];

	const requireProcess = getNodeRequireCalls(root, "process");
	const importProcess = getNodeImportStatements(root, "process");

	const allProcessImports = [...requireProcess, ...importProcess]

	for (const processImport of allProcessImports) {
		const binding = resolveBindingPath(processImport, "$.assert");
		replaceRules.push(
			{
				importNode: processImport,
				binding,
				rule: {
					kind: "identifier",
					regex: binding,
					inside: {
						kind: 'call_expression',
					}
				}
			}
		)
	}

	for (const replaceRule of replaceRules) {
		const nodes = rootNode.findAll({
			rule: replaceRule.rule
		})

		for (const node of nodes) {
			if (replaceRule.importNode) {
				const removeBind = removeBinding(replaceRule.importNode, replaceRule.binding)

				if (removeBind.edit) {
					edits.push(removeBind.edit);
				}

				if (removeBind.lineToRemove) {
					linesToRemove.push(removeBind.lineToRemove)
				}
			}

			edits.push(node.replace("assert"))
		}
	}

	let sourceCode = rootNode.commitEdits(edits);
	sourceCode = removeLines(sourceCode, linesToRemove);

	const alreadyRequiringAssert = getNodeRequireCalls(root, "assert");
	const alreadyImportingAssert = getNodeImportStatements(root, "assert");

	if (!alreadyRequiringAssert.length && !alreadyImportingAssert.length) {
		const usingRequire = rootNode.find({
			rule: {
				kind: 'call_expression',
				has: {
					kind: 'identifier',
					field: 'function',
					regex: 'require'
				}
			}
		})

		const isCommonJs = root.filename().includes('.cjs')

		if (Boolean(usingRequire) || isCommonJs) {
			return `const assert = require("node:assert");\n${sourceCode}`
		}

		return `import assert from "node:assert";\n${sourceCode}`
	}

	return sourceCode
}

import type { Edit, Range, Rule, SgNode, SgRoot } from "@codemod.com/jssg-types/main";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";
import { removeBinding } from "@nodejs/codemod-utils/ast-grep/remove-binding";
import { removeLines } from "@nodejs/codemod-utils/ast-grep/remove-lines";
import { EOL } from "node:os";

/**
 * Transforms deprecated `process.assert` usage to the standard `assert` module.
 * 
 * Transformations:
 * 1. Replaces all `process.assert` references with `assert`
 * 2. Adds the necessary import/require statement if not already present:
 *    - For ESM or files without require calls: adds `import assert from "node:assert"`
 *    - For CommonJS (.cjs files or files using require): adds `const assert = require("node:assert")`
 * 3. Removes process import/require if it was only used for assert
 * 
 * Examples:
 * 
 * **Before**:
 * ```js
 * import process from "node:process";
 * process.assert(value);
 * process.assert.strictEqual(a, b);
 * ```
 * 
 * **After**:
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
	const replaceRules: Array<{
		importNode?: SgNode;
		binding?: string;
		rule: Rule;
		replaceWith?: string;
	}> = [{
		rule: {
			kind: 'member_expression',
			pattern: "process.assert",
		},
		replaceWith: "assert"
	}];

	const processImportsToRemove = new Set<SgNode>();

	function processImports(moduleName: "process" | "node:process") {
		const requireCalls = getNodeRequireCalls(root, moduleName);
		const importStatements = getNodeImportStatements(root, moduleName);
		const allImports = [...requireCalls, ...importStatements];

		for (const processImport of allImports) {
			const binding = resolveBindingPath(processImport, "$.assert");
			replaceRules.push({
				importNode: processImport,
				binding,
				rule: {
					kind: "identifier",
					regex: binding,
					inside: {
						kind: 'call_expression',
					}
				},
				replaceWith: "assert"
			});

			if (binding) {
				replaceRules.push({
					importNode: processImport,
					binding,
					rule: {
						kind: "member_expression",
						has: {
							kind: "identifier",
							regex: `^${binding}$`,
							field: "object"
						}
					},
					replaceWith: "assert"
				});
			}

			const processUsages = rootNode.findAll({
				rule: {
					kind: 'member_expression',
					has: {
						kind: 'identifier',
						regex: '^process$'
					}
				}
			});

			let hasNonAssertUsage = false;
			for (const usage of processUsages) {
				const propertyNode = usage.field("property");
				if (propertyNode && propertyNode.text() !== "assert") {
					hasNonAssertUsage = true;
					break;
				}
			}

			if (!hasNonAssertUsage && processUsages.length > 0) {
				processImportsToRemove.add(processImport);
				linesToRemove.push(processImport.range());
			}
		}
	}

	processImports("process");
	processImports("node:process");

	for (const replaceRule of replaceRules) {
		const nodes = rootNode.findAll({
			rule: replaceRule.rule
		});

		for (const node of nodes) {
			if (replaceRule.importNode) {
				if (!processImportsToRemove.has(replaceRule.importNode)) {
					const removeBind = removeBinding(replaceRule.importNode, replaceRule.binding);

					if (removeBind.edit) {
						edits.push(removeBind.edit);
					}

					if (removeBind.lineToRemove) {
						linesToRemove.push(removeBind.lineToRemove);
					}
				}
			}

			if (replaceRule.rule.kind === "member_expression" && replaceRule.binding) {
				const objectNode = node.field("object");
				if (objectNode) {
					edits.push(objectNode.replace("assert"));
				}
			} else {
				const replaceText = replaceRule.replaceWith || "assert";
				edits.push(node.replace(replaceText));
			}
		}
	}

	let sourceCode = rootNode.commitEdits(edits);
	sourceCode = removeLines(sourceCode, linesToRemove);

	if (edits.length === 0 && linesToRemove) {
		return sourceCode;
	}

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
		});

		const isCommonJs = root.filename().includes('.cjs');

		if (Boolean(usingRequire) || isCommonJs) {
			return `const assert = require("node:assert");${EOL}${sourceCode}`;
		}

		return `import assert from "node:assert";${EOL}${sourceCode}`;
	}

	return sourceCode;
}
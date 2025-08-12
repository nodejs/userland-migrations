import type { Edit, SgRoot, Range } from "@codemod.com/jssg-types/main";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { removeLines } from "@nodejs/codemod-utils/ast-grep/remove-lines";
import { removeBinding } from "@nodejs/codemod-utils/ast-grep/remove-binding";

/**
 * Transforms `process.mainModule` usage to `require.main`. Handles direct global access
 * with `process.mainModule` or `require("node:process")` imports, as `mainModule` is CJS-only.
 *
 *
 * Handles:
 * 1. Find all destructuring require statements from 'node:process' module that import 'mainModule'
 *
 * 2. Handle the destructuring import:
 *    - If 'mainModule' is the only imported property → Remove the entire require statement
 *    - If other properties are also imported → Remove only 'mainModule' from the destructuring
 *
 * 3. Replace all code references:
 *    - Change 'mainModule' → 'require.main'
 *    - Change 'process.mainModule' → 'require.main'
 */
export default function transform(root: SgRoot): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];
	const patternsToReplace = [
		{
			pattern: "process.mainModule",
		},
	];

	const requireDeclarations = getNodeRequireCalls(root, "process");

	const destructureDeclarations = rootNode.findAll({
		rule: {
			kind: "lexical_declaration",
			has: {
				kind: "variable_declarator",
				has: {
					kind: "identifier",
					regex: "process",
				},
			},
		},
	});

	for (const declarationNode of [...requireDeclarations, ...destructureDeclarations]) {
		// Step 1: Get all requires from module nodule:process that is destructuring mainModule:
		if (declarationNode.text().includes("mainModule")) {
			const result = removeBinding(declarationNode, "mainModule");

			if (result) {
				patternsToReplace.push({
					pattern: "mainModule",
				});

				if (result.edit) {
					edits.push(result.edit);
				}

				if (result.lineToRemove) {
					linesToRemove.push(result.lineToRemove);
				}
			}
		}
	}

	// Step 3: Replace all code references:
	const nodes = rootNode.findAll({
		rule: {
			any: patternsToReplace,
		},
	});

	for (const node of nodes) {
		edits.push(node.replace("require.main"));
	}

	let sourceCode = rootNode.commitEdits(edits);
	sourceCode = removeLines(sourceCode, linesToRemove);
	return sourceCode;
}

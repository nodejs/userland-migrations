import type {
	Edit,
	Kinds,
	Range,
	Rule,
	SgNode,
	SgRoot,
	TypesMap,
} from "@codemod.com/jssg-types/main";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";
import { removeBinding } from "@nodejs/codemod-utils/ast-grep/remove-binding";
import { removeLines } from "@nodejs/codemod-utils/ast-grep/remove-lines";

type BindingToReplace = {
	rule: Rule<TypesMap>;
	node: SgNode<TypesMap, Kinds<TypesMap>>;
	binding: string;
};

/*
 * Transforms `util.log($$$ARG)` usage to `console.log(new Date().toLocaleString(), $$$ARG)`.
 *
 * Steps:
 *
 * Locate all util.log imports, noting the replacement rule, import node, and binding name.
 *
 * For each binding, replace calls to util.log($$$ARG) with the new console.log format,
 * and determine if the import line should be updated or removed.
 *
 * Apply all changes, removing or updating the import line as needed.
 */
export default function transform(root: SgRoot): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];
	const bindsToReplace: BindingToReplace[] = [];

	// @ts-expect-urror - ast-grep types are not fully compatible with JSSG types
	const nodeRequires = getNodeRequireCalls(root, "util");
	// @ts-expect-urror - ast-grep types are not fully compatible with JSSG types
	const nodeImports = getNodeImportStatements(root, "util");
	const path = "$.log";

	for (const node of [...nodeRequires, ...nodeImports]) {
		const bind = resolveBindingPath(node, path);

		// if `log` function ins't coming from `node:util`
		if (!bind) continue;

		bindsToReplace.push({
			rule: {
				pattern: `${bind}($$$ARG)`,
			},
			node,
			binding: bind,
		});
	}

	for (const bind of bindsToReplace) {
		const matches = rootNode.findAll({
			rule: bind.rule,
		});

		for (const match of matches) {
			const args = match.getMultipleMatches("ARG");

			const argsStr = args
				.map((arg) => {
					const text = arg.text();
					if (text === ",") {
						// if arg is a comman, add a space at end
						return text.padEnd(2, " ");
					}
					return text;
				})
				.join("");

			edits.push(match.replace(`console.log(new Date().toLocaleString(), ${argsStr})`));
		}

		const result = removeBinding(bind.node, bind.binding.split(".").at(0));

		if (result?.lineToRemove) {
			linesToRemove.push(result.lineToRemove);
		}

		if (result?.edit) {
			edits.push(result.edit);
		}
	}

	if (!edits.length) return;

	const sourceCode = rootNode.commitEdits(edits);

	return removeLines(sourceCode, linesToRemove);
}

import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";
import { removeBinding } from "@nodejs/codemod-utils/ast-grep/remove-binding";
import { removeLines } from "@nodejs/codemod-utils/ast-grep/remove-lines";
import type {
	Edit,
	Range,
	Rule,
	SgNode,
	SgRoot,
} from "@codemod.com/jssg-types/main";
import type Js from "@codemod.com/jssg-types/langs/javascript";

type BindingToReplace = {
	rule: Rule<Js>;
	node: SgNode<Js>;
	binding: string;
	replaceFn: (arg: string) => string;
};

const updates = [
	{
		oldBind: "$.print",
		replaceFn: (arg: string) => `console.log(${arg})`,
	},
	{
		oldBind: "$.puts",
		replaceFn: (arg: string) => `console.log(${arg})`,
	},
	{
		oldBind: "$.debug",
		replaceFn: (arg: string) => `console.error(${arg})`,
	},
	{
		oldBind: "$.error",
		replaceFn: (arg: string) => `console.error(${arg})`,
	},
];

/*
 * Transforms `util.print($$$ARG)` usage to `console.log($$$ARG)`.
 * Transforms `util.puts($$$ARG)` usage to `console.log($$$ARG)`.
 * Transforms `util.debug($$$ARG)` usage to `console.error($$$ARG)`.
 * Transforms `util.error($$$ARG)` usage to `console.error($$$ARG)`.
 *
 * Steps:
 *
 * Locate all `util.print|puts|debug|error` import imports, noting the replacement rule, import node, and binding name.
 *
 * For each binding, replace calls to util.print|puts|debug|error($$$ARG) with the new console.log|error format,
 * and determine if the import line should be updated or removed.
 *
 * Apply all changes, removing or updating the import line as needed.
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];
	const bindsToReplace: BindingToReplace[] = [];

	const nodeRequires = getNodeRequireCalls(root, "util");
	const nodeImports = getNodeImportStatements(root, "util");
	const importRequireStatement = [...nodeRequires, ...nodeImports];

	if (!importRequireStatement.length) return null;

	for (const node of importRequireStatement) {
		for (const update of updates) {
			const bind = resolveBindingPath(node, update.oldBind);

			// if `fn` function ins't coming from `node:util`
			if (!bind) continue;

			bindsToReplace.push({
				rule: {
					pattern: `${bind}($$$ARG)`,
				},
				node,
				binding: bind,
				replaceFn: update.replaceFn,
			});
		}
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

			const replace = match.replace(bind.replaceFn(argsStr));
			edits.push(replace);

			const result = removeBinding(bind.node, bind.binding.split(".").at(0));

			if (result?.lineToRemove) {
				linesToRemove.push(result.lineToRemove);
			}

			if (result?.edit) {
				edits.push(result.edit);
			}
		}
	}

	if (!edits.length) return;

	const sourceCode = rootNode.commitEdits(edits);

	return removeLines(sourceCode, linesToRemove);
}

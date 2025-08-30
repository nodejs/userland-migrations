import type { SgRoot, Edit } from "@codemod.com/jssg-types/main";

/**
 * Get the shebang line from the root.
 * @param root The root node to search.
 * @returns The shebang line if found, otherwise null.
 */
export const getShebang = (root: SgRoot) =>
	root
	.root()
	.find({
		rule: {
			kind: "hash_bang_line",
			regex: "\\bnode(\\.exe)?\\b",
			not: {
				// tree-sitter wrap hash bang in Error node
				// when it's not in the top of program node
				inside: {
					kind: "ERROR"
				}
			}
		}
	})

/**
 * Replace Node.js arguments in the shebang line.
 * @param root The root node to search.
 * @param argsToValues The mapping of argument names to their new values.
 * @param edits The list of edits to apply.
 * @returns The updated shebang line if any replacements were made, otherwise null.
 */
export const replaceNodeJsArgs = (root: SgRoot, argsToValues: Record<string, string>, edits: Edit[]) => {
	const shebang = getShebang(root);
	if (!shebang) return;

	const text = shebang.text();
	const nodeMatch = text.match(/\bnode(\.exe)?\b/);

	if (!nodeMatch) return;

	const nodeIdx = nodeMatch.index! + nodeMatch[0].length;
	const beforeNode = text.slice(0, nodeIdx);
	let afterNode = text.slice(nodeIdx);

	const sortedArgs = Object.keys(argsToValues);

	for (const argC of sortedArgs) {
		// Escape special regex characters in arg
		const esc = argC.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const regex = new RegExp(`(\\s+)(["']?)${esc}(["']?)(?=\\s|$)`, 'g');
		let replaced = false;
		const newAfterNode = afterNode.replace(regex, (_unused, ws, q1, q2) => {
			replaced = true;
			const replacement = argsToValues[argC];
			return `${ws}${q1}${replacement}${q2}`;
		});
		if (replaced && newAfterNode !== afterNode) {
			const newText = beforeNode + newAfterNode;
			edits.push(shebang.replace(newText));
			afterNode = newAfterNode;
		}
	}
};

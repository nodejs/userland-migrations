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
	// Find the "node" argument in the shebang
	const nodeMatch = text.match(/\bnode(\.exe)?\b/);

	if (!nodeMatch) return;

	// We only touch to something after node because before it's env thing
	const nodeIdx = nodeMatch.index! + nodeMatch[0].length;
	const beforeNode = text.slice(0, nodeIdx);
	let afterNode = text.slice(nodeIdx);

	for (const argC of Object.keys(argsToValues)) {
		// Escape special regex characters in arg
		const esc = argC.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const regex = new RegExp(`(\\s+)(["']?)${esc}(["']?)(?=\\s|$)`, 'g');

		// handling quote and whitespaces
		const newAfterNode = afterNode.replace(regex, (_unused, ws, q1, q2) => {
			const replacement = argsToValues[argC];

			return `${ws}${q1}${replacement}${q2}`;
		});

		if (newAfterNode !== afterNode) {
			edits.push(shebang.replace(beforeNode + newAfterNode));
			afterNode = newAfterNode;
		}
	}
};

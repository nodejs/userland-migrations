import type { SgRoot, Edit } from '@codemod.com/jssg-types/main';

const REGEX_ESCAPE_PATTERN = /[.*+?^${}()|[\]\\]/g;

/**
 * Get the shebang line from the root.
 * According to ECMAScript spec, shebangs (InputElementHashbangOrRegExp) are only
 * valid at the start of a Script or Module. We find hash_bang_lines that appear
 * at the beginning before any actual code. When multiple consecutive shebangs exist at the top,
 * we return the last one as it would be the effective shebang used.
 * @param root The root node to search.
 * @returns The shebang line if found, otherwise null.
 */
export const getShebang = (root: SgRoot) => {
	const allShebangs = root.root().findAll({
		rule: {
			kind: 'hash_bang_line',
			regex: '\\bnode(\\.exe)?\\b',
		},
	});

	if (!allShebangs.length) return null;

	// Check if first shebang is at line 0 (start of file)
	const firstShebang = allShebangs[0];
	if (firstShebang.range().start.line !== 0) {
		return null; // Shebang not at start of file
	}

	// Collect all consecutive shebangs from the start
	const validShebangs = [firstShebang];
	for (let i = 1; i < allShebangs.length; i++) {
		const prevLine = allShebangs[i - 1].range().end.line;
		const currentLine = allShebangs[i].range().start.line;

		// Check if this shebang is on the next consecutive line
		if (currentLine === prevLine || currentLine === prevLine + 1) {
			validShebangs.push(allShebangs[i]);
		} else {
			break; // Stop at first non-consecutive shebang
		}
	}

	// Return the last consecutive shebang from the start
	return validShebangs[validShebangs.length - 1];
};

/**
 * Replace Node.js arguments in the shebang line.
 * @param root The root node to search.
 * @param argsToValues The mapping of argument names to their new values.
 * @param edits The list of edits to apply.
 * @returns The updated shebang line if any replacements were made, otherwise null.
 */
export const replaceNodeJsArgs = (
	root: SgRoot,
	argsToValues: Record<string, string>,
) => {
	const shebang = getShebang(root);

	if (!shebang) return [];

	const edits: Edit[] = [];
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
		const esc = argC.replace(REGEX_ESCAPE_PATTERN, '\\$&');
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

	return edits;
};

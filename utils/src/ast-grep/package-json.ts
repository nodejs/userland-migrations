import type { SgRoot, Edit } from "@codemod.com/jssg-types/main";

/**
 * Get the "scripts" node from a package.json AST.
 * @param packageJsonRootNode The root node of the package.json AST.
 * @returns The "scripts" node, or null if not found.
 */
export const getScriptsNode = (packageJsonRootNode: SgRoot) =>
	packageJsonRootNode
	.root()
	.findAll({
		rule: {
			kind: "pair",
			inside: {
				kind: "object",
				inside: {
					kind: "pair",
					has: {
						field: "key",
						kind: "string",
						has: {
							kind: "string_content",
							regex: "scripts",
						},
					},
				},
			},
		},
	});

/**
 * Get all usage of Node.js in the "scripts" node of a package.json AST.
 * @param packageJsonRootNode The root node of the package.json AST.
 * @returns An array of nodes representing the usage of Node.js.
 */
export const getNodeJsUsage = (packageJsonRootNode: SgRoot) =>
	getScriptsNode(packageJsonRootNode)
	.flatMap((node) =>
		node.findAll({
			rule: {
				kind: "string_content",
				regex: "\\bnode(\\.exe)?\\b",
				inside: {
					kind: "string",
					inside: {
						kind: "pair",
					}
				}
			}
		})
	);

/**
 * Replace Node.js arguments in the "scripts" node of a package.json AST.
 * @param packageJsonRootNode The root node of the package.json AST.
 * @param argsToValues A record mapping arguments to their replacement values.
 * @param edits An array to collect the edits made.
 */
export const replaceNodeJsArgs = (packageJsonRootNode: SgRoot, argsToValues: Record<string, string>, edits: Edit[]) => {
	for (const nodeJsUsageNode of getNodeJsUsage(packageJsonRootNode)) {
		const text = nodeJsUsageNode.text();

		for (const [argC, argP] of Object.entries(argsToValues)) {
			const regex = new RegExp(`(?<!\\S)${argC}(?!\\S)`, 'g'); // Match standalone arguments

			if (regex.test(text)) {
				const newText = text.replace(regex, argP);

				edits.push(nodeJsUsageNode.replace(newText));
			}
		}
	}
};

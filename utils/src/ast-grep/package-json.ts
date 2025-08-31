import astGrep from "codemod:ast-grep";
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
					kind: "string",
					regex: "\\bnode(\\.exe)?\\b",
					inside: {
						field: "value",
						kind: "pair",
					},
				},
			}).map((n) => {
				const raw = n.text();
				let unquoted = raw;
				if (unquoted.startsWith('"') && unquoted.endsWith('"')) {
					unquoted = unquoted.slice(1, -1);
				}
				return {
					node: n,
					text: () => unquoted,
				};
			})
		);

/**
 * Replace Node.js arguments in the "scripts" node of a package.json AST.
 * @param packageJsonRootNode The root node of the package.json AST.
 * @param argsToValues A record mapping arguments to their replacement values.
 * @param edits An array to collect the edits made.
 */
export const replaceNodeJsArgs = (packageJsonRootNode: SgRoot, argsToValues: Record<string, string>, edits: Edit[]) => {
	for (const usage of getNodeJsUsage(packageJsonRootNode)) {
		const text = usage.text();
		const bashAST = astGrep.parse("bash", text).root();
		const command = bashAST.findAll({ rule: { kind: "command" } });
		for (const cmd of command) {
			const args = cmd.findAll({
				rule: {
					kind: "word",
					not: {
						inside: { kind: "command_name" },
					},
				},
			});
			for (const arg of args) {
				const oldArg = arg.text();
				const newValue = argsToValues[oldArg];
				if (newValue) {
					edits.push(arg.replace(newValue));
				}
			}
		}
	}
};

// TODO: add removeNodeJsArgs
/**
 * Remove Node.js arguments in the "scripts" node of a package.json AST.
 * @param packageJsonRootNode The root node of the package.json AST.
 * @param argsToRemove An array of arguments to remove.
 * @param edits An array to collect the edits made.
 */
export const removeNodeJsArgs = (
	packageJsonRootNode: SgRoot,
	argsToRemove: string[],
	edits: Edit[]
) => {
	for (const usage of getNodeJsUsage(packageJsonRootNode)) {
		const text = usage.text();
		const bashAST = astGrep.parse("bash", text).root();
		const command = bashAST.findAll({ rule: { kind: "command" } });
		for (const cmd of command) {
			const args = cmd.findAll({
				rule: {
					kind: "word",
					not: {
						inside: { kind: "command_name" },
					},
				},
			});
			for (const arg of args) {
				const oldArg = arg.text();
				if (argsToRemove.includes(oldArg)) {
					edits.push(arg.replace(""));
				}
			}
		}
	}
};

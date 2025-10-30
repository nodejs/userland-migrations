import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";
import { removeLines } from "@nodejs/codemod-utils/ast-grep/remove-lines";
import type { Edit, Range, SgNode, SgRoot } from "@codemod.com/jssg-types/main";
import type Js from "@codemod.com/jssg-types/langs/javascript";

/**
 * Transform function that converts chalk method calls to Node.js util.styleText calls.
 *
 * Examples:
 * - chalk.red("text") -> styleText("red", "text")
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];
	const chalkBinding = "chalk";

	const statements = [
		...getNodeImportStatements(root, chalkBinding),
		...getNodeRequireCalls(root, chalkBinding),
	];

	if (!statements.length) return null;

	for (const statement of statements) {
		const binding = resolveBindingPath(statement, "$");

		if (!binding) continue;

		const calls = rootNode.findAll({
			rule: {
				kind: "call_expression",
				has: {
					field: "function",
					kind: "member_expression",
				},
			},
		});

		const transformedCalls: SgNode<Js>[] = [];

		for (const call of calls) {
			const functionCall = call.field("function");

			if (!functionCall) {
				continue;
			}

			const styles = extractChalkStyles(functionCall, chalkBinding);

			if (styles.length === 0) {
				continue;
			}

			// Get the first argument (the text passed to style)
			const args = call.field("arguments");
			if (!args) continue;

			// Find all argument nodes
			const argsList = args.children().filter((c) => {
				const excluded = [",", "(", ")"];
				return !excluded.includes(c.kind());
			});

			if (argsList.length === 0) continue;

			const textArg = argsList[0].text();

			// Create the styleText replacement
			let replacement: string;

			if (styles.length === 1) {
				replacement = `styleText("${styles[0]}", ${textArg})`;
			} else {
				const stylesArray = `[${styles.map((s) => `"${s}"`).join(", ")}]`;
				replacement = `styleText(${stylesArray}, ${textArg})`;
			}

			edits.push(call.replace(replacement));
			transformedCalls.push(call);
		}

		if (edits.length > 0) {
			// Update the import or require statements if any calls were transformed
			if (statement.kind() === "import_statement") {
				// Replace entire import statement
				edits.push(statement.replace(`import { styleText } from "node:util";`));
			} else {
				edits.push(statement.replace(`{ styleText } = require("node:util")`));
			}
		}
	}

	if (!edits.length) return null;

	const sourceCode = rootNode.commitEdits(edits);
	return removeLines(sourceCode, linesToRemove);
}

// Helper function to extract chalk style methods from a member expression
function extractChalkStyles(node: SgNode<Js>, chalkBinding: string): string[] {
	const styles: string[] = [];

	function traverse(n: SgNode<Js>): boolean {
		const obj = n.field("object");
		const prop = n.field("property");

		if (obj && prop && prop.kind() === "property_identifier") {
			const propName = prop.text();

			if (obj.kind() === "identifier" && obj.text() === chalkBinding) {
				// Base case: chalk.method
				styles.push(propName);
				return true;
			}
		}

		return false;
	}

	traverse(node);
	return styles;
}

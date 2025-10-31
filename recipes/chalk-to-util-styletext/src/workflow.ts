import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import {
	getNodeImportCalls,
	getNodeImportStatements,
} from "@nodejs/codemod-utils/ast-grep/import-statement";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";
import { removeLines } from "@nodejs/codemod-utils/ast-grep/remove-lines";
import type { Edit, Range, SgNode, SgRoot } from "@codemod.com/jssg-types/main";
import type Js from "@codemod.com/jssg-types/langs/javascript";

/**
 * Transform function that converts chalk method calls to Node.js util.styleText calls.
 *
 * Examples:
 * - chalk.red("text") -> styleText("red", "text")
 * - chalk.red.bold("text") -> styleText(["red", "bold"], "text")
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];
	const chalkBinding = "chalk";

	const statements = [
		...getNodeImportStatements(root, chalkBinding),
		...getNodeRequireCalls(root, chalkBinding),
		...getNodeImportCalls(root, chalkBinding),
	];

	if (!statements.length) return null;

	for (const statement of statements) {
		const binding = resolveBindingPath(statement, "$");

		if (!binding) continue;

		const chalkCalls = rootNode.findAll({
			rule: {
				any: [
					// Pattern 1: single method calls: chalk.method(text)
					{ pattern: `${binding}.$METHOD($TEXT)` },
					// Pattern 2: chained method calls: chalk.method1.method2(text));
					{
						kind: "call_expression",
						has: {
							field: "function",
							kind: "member_expression",
						},
					},
				],
			},
		});

		for (const call of chalkCalls) {
			const methodMatch = call.getMatch("METHOD");
			const textMatch = call.getMatch("TEXT");

			if (methodMatch && textMatch) {
				// Pattern 1: chalk.method(text) -> styleText("method", text)
				const method = methodMatch.text();
				const text = textMatch.text();
				const styleMethod = COMPAT_MAP[method] || method;
				const replacement = `styleText("${styleMethod}", ${text})`;

				edits.push(call.replace(replacement));
			} else {
				// Pattern 2: chalk.method1.method2(text) -> styleText(["method1", "method2"], text)
				const functionExpr = call.field("function");

				if (!functionExpr) continue;

				const styles = extractChalkStyles(functionExpr, binding);

				if (styles.length === 0) continue;

				const args = call.field("arguments");

				if (!args) continue;

				const argsList = args.children().filter((c) => {
					const excluded = [",", "(", ")"];
					return !excluded.includes(c.kind());
				});

				if (argsList.length === 0) continue;

				const textArg = argsList[0].text();

				if (styles.length === 1) {
					const replacement = `styleText("${styles[0]}", ${textArg})`;

					edits.push(call.replace(replacement));
				} else {
					const stylesArray = `[${styles.map((s) => `"${s}"`).join(", ")}]`;
					const replacement = `styleText(${stylesArray}, ${textArg})`;

					edits.push(call.replace(replacement));
				}
			}
		}

		if (edits.length > 0) {
			// Update the import or require statements if any calls were transformed
			if (statement.kind() === "import_statement") {
				// Replace entire import statement
				edits.push(statement.replace(`import { styleText } from "node:util";`));
			} else if (statement.kind() === "variable_declarator") {
				// Handle dynamic ESM import
				if (statement.field("value")?.kind() === "await_expression") {
					edits.push(statement.replace(`{ styleText } = await import("node:util")`));
				} else {
					// Handle CommonJS require
					edits.push(statement.replace(`{ styleText } = require("node:util")`));
				}
			}
		}
	}

	if (!edits.length) return null;

	const sourceCode = rootNode.commitEdits(edits);

	return removeLines(sourceCode, linesToRemove);
}

// Compatibility mapping for chalk properties that differ in util.styleText
const COMPAT_MAP: Record<string, string> = {
	overline: "overlined",
};

function extractChalkStyles(node: SgNode<Js>, chalkBinding: string): string[] {
	const styles: string[] = [];

	function traverse(node: SgNode<Js>): boolean {
		const obj = node.field("object");
		const prop = node.field("property");

		if (obj && prop && prop.kind() === "property_identifier") {
			const propName = prop.text();

			if (obj.kind() === "identifier" && obj.text() === chalkBinding) {
				// Base case: chalk.method
				styles.push(COMPAT_MAP[propName] || propName);

				return true;
			}

			if (obj.kind() === "member_expression" && traverse(obj)) {
				// Recursive case: chain.method
				styles.push(COMPAT_MAP[propName] || propName);

				return true;
			}
		}

		return false;
	}

	traverse(node);
	return styles;
}

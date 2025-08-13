import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";
import type { SgRoot, Edit, SgNode } from "@codemod.com/jssg-types/main";

const classNames = [
	"Agent",
	"ClientRequest",
	"IncomingMessage",
	"OutgoingMessage",
	"Server",
	"ServerResponse",
];

/**
 * Transform function that converts deprecated node:http classes to use the `new` keyword
 *
 * Handles:
 * 1. http.Agent() -> new http.Agent()
 * 2. http.ClientRequest() -> new http.ClientRequest()
 * 3. http.IncomingMessage() -> new http.IncomingMessage()
 * 4. http.OutgoingMessage() -> new http.OutgoingMessage()
 * 5. http.Server() -> new http.Server()
 * 6. http.ServerResponse() -> new http.ServerResponse()
 */
export default function transform(root: SgRoot): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	const importNodes = getNodeImportStatements(root, "http");
	const requireNodes = getNodeRequireCalls(root, "http");
	const allStatementNodes = [...importNodes, ...requireNodes];
	const classes = new Set<string>();

	for (const basePath of getHttpClassBasePaths(allStatementNodes)) {
		classes.add(basePath);
	}

	for (const cls of classes) {
		const classesWithoutNew = rootNode.findAll({
			rule: {
				not: { follows: { pattern: "new" } },
				any: [
					{ pattern: `${cls}()` },
					{ pattern: `${cls}($ARGS)` },
					{ pattern: `${cls}($ARGS, $CALLBACK)` },
				],
			},
		});

		for (const clsWithoutNew of classesWithoutNew) {
			edits.push(clsWithoutNew.replace(`new ${clsWithoutNew.text()}`));
		}
	}

	if (edits.length === 0) return null;

	return rootNode.commitEdits(edits);
}

/**
 * Get the base path of the http classes
 *
 * @param statements - The import & require statements to search for the http classes
 * @returns The base path of the http classes
 */
function* getHttpClassBasePaths(statements: SgNode[]) {
	for (const cls of classNames) {
		for (const stmt of statements) {
			const resolvedPath = resolveBindingPath(stmt, `$.${cls}`);
			if (resolvedPath) {
				yield resolvedPath;
			}
		}
	}
}

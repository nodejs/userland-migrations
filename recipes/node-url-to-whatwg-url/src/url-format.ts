import type { SgRoot, Edit, SgNode } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";
import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";

/**
 * Get the literal text value of a node, if it exists.
 * @param node The node to extract the literal text from
 * @returns The literal text value, or undefined if not found
 */
const getLiteralText = (node: SgNode<JS> | null | undefined): string | undefined => {
	const kind = node.kind();

	if (kind === "string") {
		const frag = node.find({ rule: { kind: "string_fragment" } });
		return frag ? frag.text() : node.text().slice(1, -1);
	}
	if (kind === "number") return node.text();
	if (kind === "true" || kind === "false") return node.text();
	return undefined;
};

/**
 * Transforms url.format() calls to new URL().toString()
 * @param callNode The AST node representing the url.format() call
 * @returns The transformed code
 */
function urlFormatToUrlToString(callNode: SgNode<JS>[], edits: Edit[]): void {
	for (const call of callNode) {
		const optionsMatch = call.getMatch("OPTIONS");
		if (!optionsMatch) continue;

		// Find the object node that contains the URL options
		const objectNode = optionsMatch.find({ rule: { kind: "object" } });
		if (!objectNode) continue;

		const urlState: {
			protocol?: string;
			auth?: string; // user:pass
			host?: string; // host:port
			hostname?: string;
			port?: string;
			pathname?: string;
			search?: string; // ?a=b
			hash?: string; // #frag
			queryParams?: Array<[string, string]>;
		} = {};

		const pairs = objectNode.findAll({ rule: { kind: "pair" } });

		for (const pair of pairs) {
			const keyNode = pair.find({ rule: { kind: "property_identifier" } });
			const key = keyNode?.text();
			if (!key) continue;

			if (key === "query") {
				// Collect query object literals into key=value
				const queryObj = pair.find({ rule: { kind: "object" } });
				if (queryObj) {
					const qpairs = queryObj.findAll({ rule: { kind: "pair" } });
					const list: Array<[string, string]> = [];
					for (const qp of qpairs) {
						const qkeyNode = qp.find({ rule: { kind: "property_identifier" } });
						const qvalLiteral = getLiteralText(qp.find({ rule: { any: [{ kind: "string" }, { kind: "number" }, { kind: "true" }, { kind: "false" }] } }));
						if (qkeyNode && qvalLiteral !== undefined) list.push([qkeyNode.text(), qvalLiteral]);
					}
					urlState.queryParams = list;
				}
				continue;
			}

			// value might be string/number/bool
			const valueLiteral = getLiteralText(pair.find({ rule: { any: [{ kind: "string" }, { kind: "number" }, { kind: "true" }, { kind: "false" }] } }));
			if (valueLiteral === undefined) continue;

			switch (key) {
				case "protocol": {
					// normalize without trailing ':'
					urlState.protocol = valueLiteral.replace(/:$/, "");
					break;
				}
				case "auth": {
					urlState.auth = valueLiteral; // 'user:pass'
					break;
				}
				case "host": {
					urlState.host = valueLiteral; // 'example.com:8080'
					break;
				}
				case "hostname": {
					urlState.hostname = valueLiteral;
					break;
				}
				case "port": {
					urlState.port = valueLiteral;
					break;
				}
				case "pathname": {
					urlState.pathname = valueLiteral;
					break;
				}
				case "search": {
					urlState.search = valueLiteral;
					break;
				}
				case "hash": {
					urlState.hash = valueLiteral;
					break;
				}
				default:
					// ignore unknown options in this simple mapping
					break;
			}
		}

		const proto = urlState.protocol ?? "";
		const auth = urlState.auth ? `${urlState.auth}@` : "";
		let host = urlState.host;
		if (!host) {
			if (urlState.hostname && urlState.port) host = `${urlState.hostname}:${urlState.port}`;
			else if (urlState.hostname) host = urlState.hostname;
			else host = "";
		}

		let pathname = urlState.pathname ?? "";
		if (pathname && !pathname.startsWith("/")) pathname = `/${pathname}`;

		let search = urlState.search ?? "";
		if (!search && urlState.queryParams && urlState.queryParams.length > 0) {
			const qs = urlState.queryParams.map(([k, v]) => `${k}=${v}`).join("&");
			search = `?${qs}`;
		}
		if (search && !search.startsWith("?")) search = `?${search}`;

		let hash = urlState.hash ?? "";
		if (hash && !hash.startsWith("#")) hash = `#${hash}`;

		const base = proto ? `${proto}://` : "";
		const urlString = `${base}${auth}${host}${pathname}${search}${hash}`;

		const replacement = `new URL('${urlString}').toString()`;
		edits.push(call.replace(replacement));
	}
}

/**
 * Transforms `url.format` usage to `new URL().toString()`.
 *
 * See https://nodejs.org/api/deprecations.html#DEP0116
 *
 * Handle:
 * 1. `url.format(options)` → `new URL().toString()`
 * 2. `format(options)` → `new URL().toString()`
 * if imported with aliases
 * 2. `foo.format(options)` → `new URL().toString()`
 * 3. `foo(options)` → `new URL().toString()`
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	// Safety: only run on files that import/require node:url
	const hasNodeUrlImport =
		// @ts-ignore
		getNodeImportStatements(root, "url").length > 0 ||
		// @ts-ignore
		getNodeRequireCalls(root, "url").length > 0;

	if (!hasNodeUrlImport) return null;

	// Look for various ways format can be referenced
	// Build patterns using resolveBindingPath for both import and require forms
	// @ts-ignore - type difference between jssg and ast-grep wrappers
	const importNodes = getNodeImportStatements(root, "url");
	// @ts-ignore - type difference between jssg and ast-grep wrappers
	const requireNodes = getNodeRequireCalls(root, "url");
	const patterns = new Set<string>();

	for (const node of [...importNodes, ...requireNodes]) {
		// @ts-ignore - helper accepts ast-grep SgNode; runtime compatible
		const binding = resolveBindingPath(node, "$.format");
		if (!binding) continue;
		patterns.add(`${binding}($OPTIONS)`);
	}

	for (const pattern of patterns) {
		const calls = rootNode.findAll({ rule: { pattern } });

		if (calls.length) urlFormatToUrlToString(calls, edits);
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
};

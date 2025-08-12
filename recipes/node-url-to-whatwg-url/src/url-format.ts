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
	if (!node) return undefined;
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
 * @param callNode The AST nodes representing the url.format() calls
 * @param edits The edits collector
 */
function urlFormatToUrlToString(callNode: SgNode<JS>[], edits: Edit[]): void {
	for (const call of callNode) {
		const optionsMatch = call.getMatch("OPTIONS");
		if (!optionsMatch) continue;

		// Find the object node that contains the URL options
		const objectNode = optionsMatch.find({ rule: { kind: "object" } });
		if (!objectNode) continue;

		type V = { literal: true; text: string } | { literal: false; code: string };
		const urlState: {
			protocol?: V;
			auth?: V; // user:pass
			host?: V; // host:port
			hostname?: V;
			port?: V;
			pathname?: V;
			search?: V; // ?a=b
			hash?: V; // #frag
			queryParams?: Array<[string, string]>;
		} = {};

		const getValue = (pair: SgNode<JS>): V | undefined => {
			// string/number/bool
			const litNode = pair.find({
				rule: { any: [{ kind: "string" }, { kind: "number" }, { kind: "true" }, { kind: "false" }] },
			});
			const lit = getLiteralText(litNode);
			if (lit !== undefined) return { literal: true, text: lit };

			// identifier value
			const idNode = pair.find({ rule: { kind: "identifier" } });
			if (idNode) return { literal: false, code: idNode.text() };

			// shorthand property
			const shorthand = pair.find({ rule: { kind: "shorthand_property_identifier" } });
			if (shorthand) return { literal: false, code: shorthand.text() };

			// template string value
			const template = pair.find({ rule: { kind: "template_string" } });
			if (template) return { literal: false, code: template.text() };

			return undefined;
		};

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
						const qvalLiteral = getLiteralText(
							qp.find({ rule: { any: [{ kind: "string" }, { kind: "number" }, { kind: "true" }, { kind: "false" }] } }),
						);
						if (qkeyNode && qvalLiteral !== undefined) list.push([qkeyNode.text(), qvalLiteral]);
					}
					urlState.queryParams = list;
				}
				continue;
			}

			// value might be literal or identifier/shorthand/template
			const val = getValue(pair);
			if (!val) continue;

			switch (key) {
				case "protocol": {
					if (val.literal) urlState.protocol = { literal: true, text: val.text.replace(/:$/, "") };
					else urlState.protocol = val;
					break;
				}
				case "auth": {
					urlState.auth = val;
					break;
				}
				case "host": {
					urlState.host = val;
					break;
				}
				case "hostname": {
					urlState.hostname = val;
					break;
				}
				case "port": {
					urlState.port = val;
					break;
				}
				case "pathname": {
					urlState.pathname = val;
					break;
				}
				case "search": {
					urlState.search = val;
					break;
				}
				case "hash": {
					urlState.hash = val;
					break;
				}
				default:
					// ignore unknown options in this simple mapping
					break;
			}
		}

		// Also handle shorthand properties like `{ search }`
		const shorthands = objectNode.findAll({ rule: { kind: "shorthand_property_identifier" } });
		for (const sh of shorthands) {
			const name = sh.text();
			const v: V = { literal: false, code: name };
			switch (name) {
				case "protocol":
					urlState.protocol = v;
					break;
				case "auth":
					urlState.auth = v;
					break;
				case "host":
					urlState.host = v;
					break;
				case "hostname":
					urlState.hostname = v;
					break;
				case "port":
					urlState.port = v;
					break;
				case "pathname":
					urlState.pathname = v;
					break;
				case "search":
					urlState.search = v;
					break;
				case "hash":
					urlState.hash = v;
					break;
				default:
					break;
			}
		}

		// Build output segments
		type Seg = { type: "lit"; text: string } | { type: "expr"; code: string };
		const segs: Seg[] = [];
	const pushVal = (v?: V) => {
			if (!v) return;
			if (v.literal) {
				if (v.text) segs.push({ type: "lit", text: v.text });
			} else {
		// v is the non-literal branch here
		segs.push({ type: "expr", code: (v as Extract<V, { literal: false }>).code });
			}
		};

		// protocol://
		if (urlState.protocol) {
			pushVal(urlState.protocol);
			segs.push({ type: "lit", text: "://" });
		}

		// auth@
		if (urlState.auth) {
			pushVal(urlState.auth);
			segs.push({ type: "lit", text: "@" });
		}

		// host or hostname[:port]
		if (urlState.host) {
			pushVal(urlState.host);
		} else {
			if (urlState.hostname) pushVal(urlState.hostname);
			if (urlState.port) {
				if (urlState.hostname) segs.push({ type: "lit", text: ":" });
				pushVal(urlState.port);
			}
		}

		// pathname
		if (urlState.pathname) {
			const p = urlState.pathname;
			if (p.literal) {
				const text = p.text && !p.text.startsWith("/") ? `/${p.text}` : p.text;
				if (text) segs.push({ type: "lit", text });
			} else {
				pushVal(p);
			}
		}

		// search or build from query
		if (urlState.search) {
			const s = urlState.search;
			if (s.literal) {
				const text = s.text ? (s.text.startsWith("?") ? s.text : `?${s.text}`) : "";
				if (text) segs.push({ type: "lit", text });
			} else {
				pushVal(s);
			}
		} else if (urlState.queryParams && urlState.queryParams.length > 0) {
			const qs = urlState.queryParams.map(([k, v]) => `${k}=${v}`).join("&");
			if (qs) segs.push({ type: "lit", text: `?${qs}` });
		}

		// hash
		if (urlState.hash) {
			const h = urlState.hash;
			if (h.literal) {
				const text = h.text ? (h.text.startsWith("#") ? h.text : `#${h.text}`) : "";
				if (text) segs.push({ type: "lit", text });
			} else {
				pushVal(h);
			}
		}

		if (!segs.length) continue;

		const hasExpr = segs.some((s) => s.type === "expr");
		let finalExpr: string;
		if (hasExpr) {
			const esc = (s: string) => s.replace(/`/g, "\\`").replace(/\\\$/g, "\\\\$").replace(/\$\{/g, "\\${");
			finalExpr = `\`${segs.map((s) => (s.type === "lit" ? esc(s.text) : `\${${s.code}}`)).join("")}\``;
		} else {
			finalExpr = `'${segs.map((s) => (s.type === "lit" ? s.text : "")).join("")}'`;
		}

	// Include semicolon if original statement had one
	const hadSemi = /;\s*$/.test(call.text());
	const replacement = `new URL(${finalExpr}).toString()${hadSemi ? ';' : ''}`;
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

	// Look for various ways format can be referenced; build binding-aware patterns
	// @ts-ignore - type difference between jssg and ast-grep wrappers
	const importNodes = getNodeImportStatements(root, "url");
	// @ts-ignore - type difference between jssg and ast-grep wrappers
	const requireNodes = getNodeRequireCalls(root, "url");
	const patterns = new Set<string>();

	for (const node of [...importNodes, ...requireNodes]) {
		// @ts-ignore - helper accepts ast-grep SgNode; runtime compatible
		const binding = resolveBindingPath(node, "$.format");
		if (binding) patterns.add(`${binding}($OPTIONS)`);
	}

	// Fallbacks for common names and tests
	["url.format($OPTIONS)", "nodeUrl.format($OPTIONS)", "format($OPTIONS)", "urlFormat($OPTIONS)"].forEach((p) =>
		patterns.add(p),
	);

	for (const pattern of patterns) {
		const calls = rootNode.findAll({ rule: { pattern } });

		if (calls.length) urlFormatToUrlToString(calls, edits);
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
};

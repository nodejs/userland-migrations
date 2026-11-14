import { getModuleDependencies } from "@nodejs/codemod-utils/ast-grep/module-dependencies";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";
import type { Edit, SgNode, SgRoot } from "@codemod.com/jssg-types/main";
import type Js from "@codemod.com/jssg-types/langs/javascript";

type Node = SgNode<Js>;

const HOOK_NAMES = ["resolve", "load"] as const;
// Exports that `module.registerHooks()` has no equivalent for. A file that
// exports one of these is never rewritten.
const UNSUPPORTED_EXPORTS = ["initialize", "globalPreload"] as const;
const FUNCTION_KINDS = [
	"function_declaration",
	"function_expression",
	"function",
	"arrow_function",
	"generator_function_declaration",
	"generator_function",
	"method_definition",
];
const PUNCTUATION = ["(", ")", ",", "{", "}", ";"];

/**
 * Migrates asynchronous customization hooks (`module.register()`, DEP0205) to
 * synchronous, in-thread hooks (`module.registerHooks()`).
 *
 * The codemod is conservative: it rewrites a file only when it can show that
 * the result behaves the same, and otherwise leaves the file untouched.
 *
 * 1. Registration files: `register('./hooks.mjs', import.meta.url)` becomes
 *    `registerHooks(hooks)`, with the hooks module imported (or required) as a
 *    namespace. Only calls with a string-literal specifier, a parent URL that
 *    is the current file, and no options are converted. If any `register()`
 *    call in the file cannot be converted, none are.
 *
 * 2. Hooks modules: `async` `resolve` and `load` hooks whose only asynchronous
 *    work is `await nextResolve(...)` / `await nextLoad(...)` lose the `async`
 *    keyword and the `await`s. Files that also export `initialize` or
 *    `globalPreload`, or that do any other asynchronous work, are skipped.
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [
		...transformRegistrations(root),
		...transformHooksModule(rootNode),
	];

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

// ---------------------------------------------------------------------------
// Registration files
// ---------------------------------------------------------------------------

type ParsedCall = { call: Node; specifier: string; quote: string };

function transformRegistrations(root: SgRoot<Js>): Edit[] {
	const rootNode = root.root();
	const edits: Edit[] = [];

	// Don't touch files that already use (or shadow) `registerHooks`.
	if (identifiersNamed(rootNode, "registerHooks").length) return [];

	const statements = getModuleDependencies(root, "module").filter(
		(statement) =>
			["import_statement", "variable_declarator"].includes(
				statement.kind().toString(),
			),
	);
	if (!statements.length) return [];

	const esm = isEsm(rootNode);
	const names = new Map<string, string>();
	const imports: string[] = [];
	let converted = 0;

	for (const statement of statements) {
		const bindingPath = resolveBindingPath(statement, "$.register");
		if (!bindingPath) continue;

		const calls = rootNode.findAll({
			rule: {
				kind: "call_expression",
				has: { field: "function", regex: `^${escapeRegExp(bindingPath)}$` },
			},
		});
		if (!calls.length) continue;

		const parsed: ParsedCall[] = [];
		for (const call of calls) {
			const result = parseRegisterCall(call, esm);
			if (!result) return []; // One unsupported call: leave the file alone.
			parsed.push(result);
		}

		const bindingEdits = renameBinding(rootNode, statement, bindingPath, calls);
		if (!bindingEdits) return [];
		edits.push(...bindingEdits);

		for (const { call, specifier, quote } of parsed) {
			const callee = call.field("function") as Node;
			const newCallee = bindingEdits.calleeName ?? callee.text();
			let argument: string;

			if (esm) {
				let name = names.get(specifier);
				if (!name) {
					name = uniqueName(rootNode, specifier, [...names.values()]);
					names.set(specifier, name);
					imports.push(`import * as ${name} from ${quote}${specifier}${quote};`);
				}
				argument = name;
			} else {
				argument = `require(${quote}${specifier}${quote})`;
			}

			edits.push(call.replace(`${newCallee}(${argument})`));
			converted++;
		}
	}

	if (!converted) return [];

	if (imports.length) {
		const lastImport = rootNode
			.findAll({ rule: { kind: "import_statement" } })
			.at(-1);
		if (!lastImport) return [];
		const end = lastImport.range().end.index;
		edits.push({
			startPos: end,
			endPos: end,
			insertedText: `\n${imports.join("\n")}`,
		});
	}

	return edits;
}

/**
 * Accepts `register('./x.mjs', import.meta.url)` and
 * `register(new URL('./x.mjs', import.meta.url))`, as well as the CommonJS
 * `pathToFileURL(__filename)` equivalents. Anything else (variables, template
 * literals, `data`, `transferList`, a different parent URL) is rejected.
 */
function parseRegisterCall(call: Node, esm: boolean): ParsedCall | null {
	// In ESM the hooks module is imported at the top of the file, so the call
	// itself must be at the top level too.
	const statement = call.parent();
	if (esm) {
		if (!statement?.is("expression_statement")) return null;
		if (!statement.parent()?.is("program")) return null;
	}

	const args = argumentNodes(call);
	if (args.length < 1 || args.length > 2) return null;

	const [first, second] = args as [Node, Node | undefined];
	let literal: Node | null = null;
	let needsParent = true;

	if (first.is("string")) {
		literal = first;
	} else if (first.is("new_expression")) {
		// new URL('./x.mjs', import.meta.url)
		const callee = first.field("constructor");
		const urlArgs = argumentNodes(first);
		if (
			callee?.text() === "URL" &&
			urlArgs.length === 2 &&
			urlArgs[0]?.is("string") &&
			urlArgs[1]?.text() === "import.meta.url"
		) {
			literal = urlArgs[0];
			needsParent = false;
		}
	}
	if (!literal) return null;

	if (second) {
		if (!isCurrentFileUrl(second.text())) return null;
	} else if (needsParent) {
		return null;
	}

	const text = literal.text();
	const quote = text[0] as string;
	const specifier = text.slice(1, -1);
	if (!specifier || specifier.includes("\\") || specifier.includes(quote)) {
		return null;
	}
	if (/^[a-z][a-z0-9+.-]*:/i.test(specifier)) {
		// Only `file:` URLs, and only where `import` can load them.
		if (!esm || !specifier.startsWith("file:")) return null;
	}

	return { call, specifier, quote };
}

function isCurrentFileUrl(text: string): boolean {
	return (
		text === "import.meta.url" ||
		/^(?:\w+\.)?pathToFileURL\(\s*__filename\s*\)(?:\.href)?$/.test(text)
	);
}

type BindingEdits = Edit[] & { calleeName?: string };

/**
 * Renames the `register` binding to `registerHooks` in the import/require
 * statement. Returns undefined when `register` is used for anything but the
 * calls being converted.
 */
function renameBinding(
	rootNode: Node,
	statement: Node,
	bindingPath: string,
	calls: Node[],
): BindingEdits | undefined {
	const edits: BindingEdits = [];

	// `mod.register(...)`: only the property changes.
	if (bindingPath.includes(".")) {
		const parts = bindingPath.split(".");
		parts[parts.length - 1] = "registerHooks";
		edits.calleeName = parts.join(".");
		return edits;
	}

	const local = bindingPath;
	const references = identifiersNamed(rootNode, local);
	// The calls, plus the binding itself.
	if (references.length !== calls.length + 1) return undefined;

	if (statement.is("import_statement")) {
		const specifier = statement.find({
			rule: {
				kind: "import_specifier",
				has: { field: "name", kind: "identifier", regex: "^register$" },
			},
		});
		if (!specifier) return undefined;
		const alias = specifier.field("alias");
		const name = specifier.field("name") as Node;
		edits.push(name.replace("registerHooks"));
		if (!alias) edits.calleeName = "registerHooks";
		return edits;
	}

	// const { register } = require('node:module')
	// const { register: reg } = require('node:module')
	const shorthand = statement.find({
		rule: {
			kind: "shorthand_property_identifier_pattern",
			regex: "^register$",
		},
	});
	if (shorthand) {
		edits.push(shorthand.replace("registerHooks"));
		edits.calleeName = "registerHooks";
		return edits;
	}

	const pair = statement.find({
		rule: {
			kind: "pair_pattern",
			has: { field: "key", kind: "property_identifier", regex: "^register$" },
		},
	});
	const key = pair?.field("key");
	if (key && pair?.field("value")?.text() === local) {
		edits.push(key.replace("registerHooks"));
		return edits;
	}

	return undefined;
}

// ---------------------------------------------------------------------------
// Hooks modules
// ---------------------------------------------------------------------------

function transformHooksModule(rootNode: Node): Edit[] {
	const hooks = new Map<string, Node>();

	for (const name of UNSUPPORTED_EXPORTS) {
		if (findExport(rootNode, name)) return [];
	}

	for (const name of HOOK_NAMES) {
		const found = findExport(rootNode, name);
		if (found === null) continue;
		// Exported, but not something we can inspect: leave the file alone.
		if (found === "unknown") return [];
		hooks.set(name, found);
	}
	if (!hooks.size) return [];

	const asyncNames = asyncFunctionNames(rootNode);
	const edits: Edit[] = [];

	for (const fn of hooks.values()) {
		const fnEdits = convertHook(fn, asyncNames);
		if (!fnEdits) return [];
		edits.push(...fnEdits);
	}

	return edits;
}

/** Returns the edits that make a hook synchronous, or null if it cannot be. */
function convertHook(fn: Node, asyncNames: Set<string>): Edit[] | null {
	const asyncKeyword = fn.children().find((child) => child.kind() === "async");
	// Already synchronous (or not a function we recognize): nothing to do.
	if (!asyncKeyword) return [];

	const body = fn.field("body") as Node | null;
	if (!body) return null;
	if (fn.is("generator_function_declaration") || fn.is("generator_function")) {
		return null;
	}

	const next = nextParameterName(fn);
	const bodyText = body.text();

	// Anything asynchronous that is not `await next(...)`.
	if (/\bfor\s+await\b/.test(bodyText)) return null;
	if (/\bPromise\b|\.then\s*\(|\bimport\s*\(/.test(bodyText)) return null;
	for (const name of asyncNames) {
		if (new RegExp(`\\b${escapeRegExp(name)}\\b`).test(bodyText)) return null;
	}

	const awaits = body.findAll({ rule: { kind: "await_expression" } });
	if (awaits.length && !next) return null;

	const edits: Edit[] = [];
	for (const expression of awaits) {
		const argument = expression.children().find((c) => c.kind() !== "await");
		if (argument?.kind() !== "call_expression") return null;
		if (argument.field("function")?.text() !== next) return null;
		// An await inside a nested function is not ours to unwrap.
		const owner = expression
			.ancestors()
			.find((ancestor) => FUNCTION_KINDS.includes(ancestor.kind().toString()));
		if (owner?.range().start.index !== fn.range().start.index) return null;
		edits.push(expression.replace(argument.text()));
	}

	// `next` may only be called, never passed around or stored.
	if (next) {
		for (const reference of identifiersNamed(body, next)) {
			const parent = reference.parent();
			const isCall =
				parent?.is("call_expression") &&
				parent.field("function")?.range().start.index ===
					reference.range().start.index;
			if (!isCall) return null;
		}
	}

	const after = asyncKeyword.next();
	edits.push({
		startPos: asyncKeyword.range().start.index,
		endPos: after?.range().start.index ?? asyncKeyword.range().end.index,
		insertedText: "",
	});

	return edits;
}

/** The name of the third parameter (`nextResolve` / `nextLoad`), if any. */
function nextParameterName(fn: Node): string | null {
	const params = fn.field("parameters") ?? fn.field("parameter");
	if (!params) return null;
	const list = params.is("formal_parameters")
		? params.children().filter((c) => !PUNCTUATION.includes(c.kind().toString()))
		: [params];
	const third = list[2];
	if (!third) return null;
	if (third.is("identifier")) return third.text();
	if (third.is("required_parameter")) {
		const pattern = third.field("pattern");
		return pattern?.is("identifier") ? pattern.text() : null;
	}
	return null;
}

/**
 * Finds the function that a module exports under `name`.
 * Returns null if `name` is not exported, "unknown" if it is exported but is
 * not a function we can inspect.
 */
function findExport(rootNode: Node, name: string): Node | "unknown" | null {
	const found = (node: Node | null | undefined): Node | "unknown" =>
		node && FUNCTION_KINDS.includes(node.kind().toString()) ? node : "unknown";

	for (const statement of rootNode.children()) {
		// export async function name() {}  /  export const name = async () => {}
		if (statement.is("export_statement")) {
			const declaration = statement.field("declaration") as Node | null;
			if (declaration?.is("function_declaration")) {
				if (declaration.field("name")?.text() === name) return declaration;
			}
			if (declaration?.is("lexical_declaration")) {
				for (const declarator of declaration.findAll({
					rule: { kind: "variable_declarator" },
				})) {
					if (declarator.field("name")?.text() === name) {
						return found(declarator.field("value"));
					}
				}
			}
			// export { local as name }
			for (const specifier of statement.findAll({
				rule: { kind: "export_specifier" },
			})) {
				const exported = specifier.field("alias") ?? specifier.field("name");
				if (exported?.text() === name) {
					return localFunction(rootNode, specifier.field("name")?.text() ?? "");
				}
			}
			continue;
		}

		// exports.name = fn  /  module.exports.name = fn
		// module.exports = { name, other: fn, method() {} }
		if (statement.is("expression_statement")) {
			const assignment = statement.child(0);
			if (!assignment?.is("assignment_expression")) continue;
			const left = assignment.field("left")?.text();
			const right = assignment.field("right");

			if (left === `exports.${name}` || left === `module.exports.${name}`) {
				return right?.is("identifier")
					? localFunction(rootNode, right.text())
					: found(right);
			}

			if (left === "module.exports" && right?.is("object")) {
				for (const member of right.children()) {
					if (member.is("shorthand_property_identifier")) {
						if (member.text() === name) return localFunction(rootNode, name);
					} else if (member.is("pair")) {
						if (member.field("key")?.text() !== name) continue;
						const value = member.field("value");
						return value?.is("identifier")
							? localFunction(rootNode, value.text())
							: found(value);
					} else if (member.is("method_definition")) {
						if (member.field("name")?.text() === name) return member;
					}
				}
			}
		}
	}

	return null;
}

/** A top-level function (or `const x = () => {}`) called `name`. */
function localFunction(rootNode: Node, name: string): Node | "unknown" {
	for (let statement of rootNode.children()) {
		if (statement.is("export_statement")) {
			statement = statement.field("declaration") ?? statement;
		}
		if (statement.is("function_declaration")) {
			if (statement.field("name")?.text() === name) return statement;
		}
		if (statement.is("lexical_declaration") || statement.is("variable_declaration")) {
			for (const declarator of statement.findAll({
				rule: { kind: "variable_declarator" },
			})) {
				if (declarator.field("name")?.text() !== name) continue;
				const value = declarator.field("value");
				return value && FUNCTION_KINDS.includes(value.kind().toString())
					? value
					: "unknown";
			}
		}
	}
	return "unknown";
}

/** Names of the `async` functions defined in this file (other than hooks). */
function asyncFunctionNames(rootNode: Node): Set<string> {
	const names = new Set<string>();
	const hookFunctions = new Set<string>(HOOK_NAMES);

	for (const declaration of rootNode.findAll({
		rule: { kind: "function_declaration" },
	})) {
		const name = declaration.field("name")?.text();
		const isAsync = declaration.children().some((c) => c.kind() === "async");
		if (name && isAsync && !hookFunctions.has(name)) names.add(name);
	}

	for (const declarator of rootNode.findAll({
		rule: { kind: "variable_declarator" },
	})) {
		const name = declarator.field("name")?.text();
		const value = declarator.field("value");
		const isAsync = value?.children().some((c) => c.kind() === "async");
		if (name && isAsync && !hookFunctions.has(name)) names.add(name);
	}

	return names;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function argumentNodes(call: Node): Node[] {
	const args = call.field("arguments");
	if (!args) return [];
	return args
		.children()
		.filter((child) => !PUNCTUATION.includes(child.kind().toString()));
}

function identifiersNamed(scope: Node, name: string): Node[] {
	return scope.findAll({
		rule: {
			any: [
				{ kind: "identifier", regex: `^${escapeRegExp(name)}$` },
				{
					kind: "shorthand_property_identifier_pattern",
					regex: `^${escapeRegExp(name)}$`,
				},
			],
		},
	});
}

function isEsm(rootNode: Node): boolean {
	return Boolean(
		rootNode.find({
			rule: {
				any: [{ kind: "import_statement" }, { kind: "export_statement" }],
			},
		}) || rootNode.find({ rule: { pattern: "import.meta" } }),
	);
}

/** `./my-hooks.mjs` -> `myHooks`, made unique within the file. */
function uniqueName(rootNode: Node, specifier: string, taken: string[]): string {
	const base = specifier.split("/").pop()?.replace(/\.[cm]?[jt]s$/, "") ?? "";
	let name = base
		.replace(/[^a-zA-Z0-9_$]+(.)?/g, (_, char: string | undefined) =>
			char ? char.toUpperCase() : "",
		)
		.replace(/^[^a-zA-Z_$]+/, "");
	if (!name) name = "hooks";
	name = name[0]?.toLowerCase() + name.slice(1);

	const used = (candidate: string) =>
		taken.includes(candidate) || identifiersNamed(rootNode, candidate).length > 0;

	let candidate = name;
	for (let i = 2; used(candidate); i++) candidate = `${name}${i}`;
	return candidate;
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

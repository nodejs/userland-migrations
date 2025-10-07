import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";
import { removeLines } from "@nodejs/codemod-utils/ast-grep/remove-lines";
import type { Edit, Range, SgRoot } from "@codemod.com/jssg-types/main";
import type Js from "@codemod.com/jssg-types/langs/javascript";

const ZLIB_FACTORIES = [
	"createGzip",
	"createGunzip",
	"createDeflate",
	"createInflate",
	"createBrotliCompress",
	"createBrotliDecompress",
	"createUnzip",
];

const DECL_PATTERNS = [
	'const $VAR = await import($MODULE)',
	'let $VAR = await import($MODULE)',
	'var $VAR = await import($MODULE)'
];

const FUNC_KINDS = ["function_declaration", "function_expression", "arrow_function"] as const;

// Helper to find all identifier nodes within a given node
function findIdentifiers(node: ReturnType<SgRoot<Js>["root"]>): string[] {
	const identifiers: string[] = [];
	const stack = [node];

	while (stack.length) {
		const current = stack.pop()!;
		if (current.kind() === "identifier") {
			identifiers.push(current.text());
		}
		stack.push(...current.children());
	}

	return identifiers;
}

export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	// 1 Find all static zlib imports/requires
	const importNodes = [
		...getNodeRequireCalls(root, "node:zlib"),
		...getNodeImportStatements(root, "node:zlib")
	];

	const factoryBindings: string[] = [];
	const streamVariables: string[] = [];

	// 1.a Handle static imports: `import { createGzip } from "node:zlib"
	for (const node of importNodes) {
		for (const factory of ZLIB_FACTORIES) {
			const binding = resolveBindingPath(node, `$.${factory}`);

			if (binding && !factoryBindings.includes(binding)) factoryBindings.push(binding);
		}
	}

	// 1.b Handle dynamic imports: `await import("node:zlib")
	const allDynamicImports: typeof rootNode[] = [];

	for (const pattern of DECL_PATTERNS) {
		const dynamicImports = rootNode.findAll({ rule: { pattern } });
		allDynamicImports.push(...dynamicImports);
	}

	for (const imp of allDynamicImports) {
		const moduleName = imp.find({
			rule: {
				kind: "string_fragment",
				inside: {
					kind: "string",
					inside: { kind: "arguments" }
				}
			}
		})?.text();

		if (moduleName === "node:zlib") {
			const varName = imp.find({
				rule: {
					kind: "identifier",
					inside: { kind: "variable_declarator" }
				}
			})?.text();

			if (varName) {
				for (const factory of ZLIB_FACTORIES) {
					factoryBindings.push(`${varName}.${factory}`);
				}
			}
		}
	}

	// If no import is found that means we can skip transformation on this file
	if (!importNodes.length && !allDynamicImports.length) return null;

	// 2 Track variables assigned from factories (const, let, var)
	for (const binding of factoryBindings) {
		const patterns = [
			`const $$$VAR = ${binding}($$$ARGS)`,
			`let $$$VAR = ${binding}($$$ARGS)`,
			`var $$$VAR = ${binding}($$$ARGS)`
		];

		for (const pattern of patterns) {
			const matches = rootNode.findAll({ rule: { pattern } });
			
			for (const match of matches) {
				const varMatch = match.getMultipleMatches("VAR");

				if (varMatch.length) {
					const varName = varMatch[0].text();
					if (!streamVariables.includes(varName)) streamVariables.push(varName);
				}
			}
		}
	}

	// 3 Replace .bytesRead → .bytesWritten for tracked variables
	for (const variable of streamVariables) {
		const matches = rootNode.findAll({ rule: { pattern: `${variable}.bytesRead` } });

		for (const match of matches) {
			edits.push(match.replace(match.text().replace(".bytesRead", ".bytesWritten")));
		}
	}

	// Step 4: Replace .bytesRead → .bytesWritten for function parameters
	for (const kind of FUNC_KINDS) {
		const funcs = rootNode.findAll({ rule: { kind } });

		for (const func of funcs) {
			const formalParamsNode = func.children().find(child => child.kind() === "formal_parameters");
			
			if (!formalParamsNode) continue;

			const paramNames = findIdentifiers(formalParamsNode);

			for (const paramName of paramNames) {
				const matches = rootNode.findAll({ rule: { pattern: `${paramName}.bytesRead` } });
				for (const match of matches) {
					edits.push(match.replace(match.text().replace(".bytesRead", ".bytesWritten")));
				}
			}
		}
	}

	if (!edits.length) return null;

	return removeLines(rootNode.commitEdits(edits), linesToRemove);
}

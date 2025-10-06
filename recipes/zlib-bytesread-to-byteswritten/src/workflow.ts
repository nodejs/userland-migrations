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

	for (const node of importNodes) {
		const baseBind = resolveBindingPath(node, "$");

		if (baseBind) {
			for (const factory of ZLIB_FACTORIES) factoryBindings.push(`${baseBind}.${factory}`);
		}
		for (const factory of ZLIB_FACTORIES) {
			const binding = resolveBindingPath(node, `$.${factory}`);
			if (binding && !factoryBindings.includes(binding)) factoryBindings.push(binding);
		}
	}

	// 1.b Handle dynamic imports: `await import("node:zlib")`
	const dynamicImports = rootNode.findAll({ rule: { pattern: "const $$$VAR = await import($$$MODULE)" } });
	for (const imp of dynamicImports) {
		const moduleName = imp.getMultipleMatches("MODULE")[0]?.text().replace(/['"]/g, "");
		if (moduleName === "node:zlib") {
			const varName = imp.getMultipleMatches("VAR")[0]?.text();
			if (varName) {
				for (const factory of ZLIB_FACTORIES) {
					factoryBindings.push(`${varName}.${factory}`);
				}
			}
		}
	}

	// If any import is found it's mean we can skip transformation on this file
	if (!importNodes.length && dynamicImports.length === 0) return null;

	// 2 Track variables assigned from factories (const, let, var)
	for (const factory of factoryBindings) {
		const patterns = [
			`const $$$VAR = ${factory}($$$ARGS)`,
			`let $$$VAR = ${factory}($$$ARGS)`,
			`var $$$VAR = ${factory}($$$ARGS)`
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

	// 4 Replace .bytesRead → .bytesWritten for function parameters
	const funcPatterns = ["function $$$NAME($$$PARAMS) { $$$BODY }"];
	for (const pattern of funcPatterns) {
		const funcs = rootNode.findAll({ rule: { pattern } });

		for (const func of funcs) {
			const params = func.getMultipleMatches("PARAMS");

			for (const param of params) {
				const paramNames = param
					.text()
					.split(",")
					.map((p) => p.replace(/\/\*.*\*\//, "").trim())
					.filter(Boolean);

				for (const paramName of paramNames) {
					const matches = rootNode.findAll({ rule: { pattern: `${paramName}.bytesRead` } });

					for (const match of matches) {
						edits.push(match.replace(match.text().replace(".bytesRead", ".bytesWritten")));
					}
				}
			}
		}
	}

	if (!edits.length) return null;

	return removeLines(rootNode.commitEdits(edits), linesToRemove);
}

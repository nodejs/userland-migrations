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

	// 1️ Find all zlib imports/requires
	const nodeRequires = getNodeRequireCalls(root, "node:zlib");
	const nodeImports = getNodeImportStatements(root, "node:zlib");
	const importNodes = [...nodeRequires, ...nodeImports];
	if (!importNodes.length) return null;

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

	// 2️ Track variables assigned from factories
	for (const factory of factoryBindings) {
		const matches = rootNode.findAll({ rule: { pattern: `const $$$VAR = ${factory}($$$ARGS)` } });
		for (const match of matches) {
			const varMatch = match.getMultipleMatches("VAR");
			if (varMatch.length) {
				const varName = varMatch[0].text();
				if (!streamVariables.includes(varName)) streamVariables.push(varName);
			}
		}
	}


	// 3️ Replace .bytesRead → .bytesWritten for tracked variables
	for (const variable of streamVariables) {
		const matches = rootNode.findAll({ rule: { pattern: `${variable}.bytesRead` } });
		for (const match of matches) {
			edits.push(match.replace(match.text().replace(".bytesRead", ".bytesWritten")));
		}
	}

	// 4️ Replace .bytesRead → .bytesWritten for function parameters
	const funcPatterns = [
		"function $$$NAME($$$PARAMS) { $$$BODY }"
	];

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

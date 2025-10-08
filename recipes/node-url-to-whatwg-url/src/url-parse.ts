import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";
import type { SgRoot, Edit } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";

/**
 * Transforms `url.parse` usage to `new URL()`.
 *
 * See https://nodejs.org/api/deprecations.html#DEP0116 for more details.
 *
 * Handle:
 * 1. `url.parse(urlString)` → `new URL(urlString)`
 * 2. `parse(urlString)` → `new URL(urlString)`
 * if imported with aliases
 * 2. `foo.parse(urlString)` → `new URL(urlString)`
 * 3. `foo(urlString)` → `new URL(urlString)`
 */
export default function transform(root: SgRoot<JS>): string | null {
    const rootNode = root.root();
    const edits: Edit[] = [];

    // Safety: only run on files that import/require node:url
    const hasNodeUrlImport = (
        getNodeImportStatements(root, "url").length > 0
        || getNodeRequireCalls(root, "url").length > 0
    );

	if (!hasNodeUrlImport) return null;

	// 1) Replace parse calls with new URL() using binding-aware patterns
    const importNodes = getNodeImportStatements(root, "url");
    const requireNodes = getNodeRequireCalls(root, "url");
	const parseCallPatterns = new Set<string>();

	for (const node of [...importNodes, ...requireNodes]) {
        const binding = resolveBindingPath(node, "$.parse");

        if (binding) parseCallPatterns.add(`${binding}($ARG)`);
    }

	// 1.a) Identify variables assigned from parse(...) so we only rewrite legacy
	// properties (auth, path, hostname) on those specific objects
	const parseResultVars = new Set<string>();
	for (const pattern of parseCallPatterns) {
		const matches = rootNode.findAll({
			rule: {
				any: [
					{ pattern: `const $OBJ = ${pattern}` },
					{ pattern: `let $OBJ = ${pattern}` },
					{ pattern: `var $OBJ = ${pattern}` },
					{ pattern: `$OBJ = ${pattern}` }
				]
			}
		});

		const validVariableNameRegex = /^[$A-Z_a-z][$\w]*$/;

		for (const m of matches) {
			const obj = m.getMatch("OBJ");
			if (!obj) continue;
			const name = obj.text();
			if (validVariableNameRegex.test(name)) parseResultVars.add(name);
		}
	}

	// 1.b) Replace parse calls with new URL()
	//      Also, for declarations using `var`, upgrade to `let` while keeping `const` as-is.
	for (const pattern of parseCallPatterns) {
		const calls = rootNode.findAll({ rule: { pattern } });

		for (const call of calls) {
			const arg = call.getMatch("ARG");
			if (!arg) continue;

			edits.push(call.replace(`new URL(${arg.text()})`));
		}
	}

    // 2) Transform legacy properties on URL object
    //    - auth => `${obj.username}:${obj.password}`
    //    - path => `${obj.pathname}${obj.search}`
    //    - hostname => obj.hostname.replace(/^[\[|\]]$/, '')  (strip square brackets)
	const fieldsToReplace = [
		{
			key: "auth",
			replaceFn: (base: string, hadSemi: boolean, declKind: "const" | "let" | "var") => {
				const kind = declKind === "var" ? "let" : declKind;

				return `${kind} auth = \`\${${base}.username}:\${${base}.password}\`${hadSemi ? ";" : ""}`;
			},
		},
		{
			key: "path",
			replaceFn: (base: string, hadSemi: boolean, declKind: "const" | "let" | "var") => {
				const kind = declKind === "var" ? "let" : declKind;

				return `${kind} path = \`\${${base}.pathname}\${${base}.search}\`${hadSemi ? ";" : ""}`;
			},
		},
		{
			key: "hostname",
			replaceFn: (base: string, hadSemi: boolean, declKind: "const" | "let" | "var") => {
				const kind = declKind === "var" ? "let" : declKind;

				return `${kind} hostname = ${base}.hostname.replace(/^\\[|\\]$/, '')${hadSemi ? ";" : ""}`;
			},
		},
	];

	for (const { key, replaceFn } of fieldsToReplace) {
		// 2.a) Handle property access for identifiers that originate from parse(...)
		for (const varName of parseResultVars) {
			const propertyAccesses = rootNode.findAll({ rule: { pattern: `${varName}.${key}` } });
			for (const node of propertyAccesses) {
				let replacement = "";

				if (key === "auth") {
					replacement = `\`\${${varName}.username}:\${${varName}.password}\``;
				} else if (key === "path") {
					replacement = `\`\${${varName}.pathname}\${${varName}.search}\``;
				} else if (key === "hostname") {
					replacement = `${varName}.hostname.replace(/^\\[|\\]$/, '')`;
				}
				edits.push(node.replace(replacement));
			}

			// destructuring for identifiers without looping kinds
			const destructures = rootNode.findAll({
				rule: {
					any: [
						{ pattern: `const { ${key} } = ${varName}` },
						{ pattern: `let { ${key} } = ${varName}` },
						{ pattern: `var { ${key} } = ${varName}` }
					]
				}
			});
			for (const node of destructures) {
				const text = node.text();
				const hadSemi = /;\s*$/.test(text);
				const declKind: "const" | "let" | "var" = text.trimStart().startsWith("var ") ? "var" : (text.trimStart().startsWith("const ") ? "const" : "let");
				const replacement = replaceFn(varName, hadSemi, declKind);
				edits.push(node.replace(replacement));
			}
		}

		// 2.b) Handle direct call expressions like parse(...).auth and
		// destructuring from parse(...)
		for (const pattern of parseCallPatterns) {
			const directAccesses = rootNode.findAll({ rule: { pattern: `${pattern}.${key}` } });
			for (const node of directAccesses) {
				// Reconstruct base as the matched expression before .key
				const baseExpr = node.text().replace(new RegExp(`\\.${key}$`), "");
				let replacement = "";

				if (key === "auth") {
					replacement = `\`\${${baseExpr}.username}:\${${baseExpr}.password}\``;
				} else if (key === "path") {
					replacement = `\`\${${baseExpr}.pathname}\${${baseExpr}.search}\``;
				} else if (key === "hostname") {
					replacement = `${baseExpr}.hostname.replace(/^\\[|\\]$/, '')`;
				}
				edits.push(node.replace(replacement));
			}



			// direct destructuring from parse(...), cover all kinds in a single query
			const directDestructures = rootNode.findAll({
				rule: {
					any: [
						{ pattern: `const { ${key} } = ${pattern}` },
						{ pattern: `let { ${key} } = ${pattern}` },
						{ pattern: `var { ${key} } = ${pattern}` }
					]
				}
			});

			for (const node of directDestructures) {
				const text = node.text();
				const hadSemi = /;\s*$/.test(text);
				const rhsText = text.replace(/^[^{]+{\s*[^}]+\s*}\s*=\s*/, "");
				const declKind: "const" | "let" | "var" = text.trimStart().startsWith("var ") ? "var" : (text.trimStart().startsWith("const ") ? "const" : "let");
				const replacement = replaceFn(rhsText, hadSemi, declKind);
				edits.push(node.replace(replacement));
			}
		}

		// 2.c) Handle property access and destructuring after parse calls were
		// replaced with new URL($ARG)
		const newURLAccesses = rootNode.findAll({ rule: { pattern: `new URL($ARG).${key}` } });

		for (const node of newURLAccesses) {
			const baseExpr = node.text().replace(new RegExp(`\\.${key}$`), "");
			let replacement = "";

			if (key === "auth") {
				replacement = `\`\${${baseExpr}.username}:\${${baseExpr}.password}\``;
			} else if (key === "path") {
				replacement = `\`\${${baseExpr}.pathname}\${${baseExpr}.search}\``;
			} else if (key === "hostname") {
				replacement = `${baseExpr}.hostname.replace(/^\\[|\\]$/, '')`;
			}
			edits.push(node.replace(replacement));
		}

		// destructuring from new URL, single query for all kinds
		const newURLDestructures = rootNode.findAll({
			rule: {
				any: [
					{ pattern: `const { ${key} } = new URL($ARG)` },
					{ pattern: `let { ${key} } = new URL($ARG)` },
					{ pattern: `var { ${key} } = new URL($ARG)` }
				]
			}
		});

		for (const node of newURLDestructures) {
			const text = node.text();
			const hadSemi = /;\s*$/.test(text);
			const rhsText = text.replace(/^[^{]+{\s*[^}]+\s*}\s*=\s*/, "");
			const declKind = text.trimStart().startsWith("var ") ? "var" : (text.trimStart().startsWith("const ") ? "const" : "let");
			const replacement = replaceFn(rhsText, hadSemi, declKind);
			edits.push(node.replace(replacement));
		}
	}

    if (!edits.length) return null;

    return rootNode.commitEdits(edits);
};

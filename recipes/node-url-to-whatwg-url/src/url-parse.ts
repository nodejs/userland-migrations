import type { SgRoot, Edit } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";
import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";

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
    const hasNodeUrlImport =
		// @ts-ignore
        getNodeImportStatements(root, "url").length > 0 ||
        // @ts-ignore
		getNodeRequireCalls(root, "url").length > 0;

    if (!hasNodeUrlImport) return null;

	// 1) Replace parse calls with new URL() using binding-aware patterns
    // @ts-ignore - type difference between jssg and ast-grep wrappers
    const importNodes = getNodeImportStatements(root, "url");
    // @ts-ignore - type difference between jssg and ast-grep wrappers
    const requireNodes = getNodeRequireCalls(root, "url");
	const parseCallPatterns = new Set<string>();

    for (const node of [...importNodes, ...requireNodes]) {
        // @ts-ignore resolve across wrappers
        const binding = resolveBindingPath(node, "$.parse");
        if (!binding) continue;
        parseCallPatterns.add(`${binding}($ARG)`);
    }

	// 1.a) Identify variables assigned from parse(...) so we only rewrite legacy
	// properties (auth, path, hostname) on those specific objects
	const parseResultVars = new Set<string>();
	for (const pattern of parseCallPatterns) {
		// const/let/var declarations
		const declKinds = ["const", "let", "var"] as const;
		for (const kind of declKinds) {
			const decls = rootNode.findAll({ rule: { pattern: `${kind} $OBJ = ${pattern}` } });
			for (const d of decls) {
				const obj = d.getMatch("OBJ");
				if (!obj) continue;
				const name = obj.text();
				// Only simple identifiers
				if (/^[$A-Z_a-z][$\w]*$/.test(name)) parseResultVars.add(name);
			}
		}
		// simple assignments
		const assigns = rootNode.findAll({ rule: { pattern: `$OBJ = ${pattern}` } });
		for (const a of assigns) {
			const obj = a.getMatch("OBJ");
			if (!obj) continue;
			const name = obj.text();
			if (/^[$A-Z_a-z][$\w]*$/.test(name)) parseResultVars.add(name);
		}
	}

	// 1.b) Replace parse calls with new URL()
	for (const pattern of parseCallPatterns) {
		const calls = rootNode.findAll({ rule: { pattern } });

		for (const call of calls) {
			const arg = call.getMatch("ARG");
			if (!arg) continue;

			const replacement = `new URL(${arg.text()})`;
			edits.push(call.replace(replacement));
		}
	}

    // 2) Transform legacy properties on URL object
    //    - auth => `${obj.username}:${obj.password}`
    //    - path => `${obj.pathname}${obj.search}`
    //    - hostname => obj.hostname.replace(/^[\[|\]]$/, '')  (strip square brackets)

    // We will only transform legacy properties when the base object is either:
    // - a variable assigned from url.parse/parse(...)
    // - a direct url.parse/parse(...) call expression
    // Destructuring: const { auth } = obj -> const auth = `${obj.username}:${obj.password}`
    const fieldsToReplace = [
		{
			key: "auth",
			replaceFn: (base: string, hadSemi: boolean) =>
				`const auth = \`\${${base}.username}:\${${base}.password}\`${hadSemi ? ";" : ""}`,
		},
		{
			key: "path",
			replaceFn: (base: string, hadSemi: boolean) =>
				`const path = \`\${${base}.pathname}\${${base}.search}\`${hadSemi ? ";" : ""}`,
		},
		{
			key: "hostname",
			replaceFn: (base: string, hadSemi: boolean) =>
				`const hostname = ${base}.hostname.replace(/^\\[|\\]$/, '')${hadSemi ? ";" : ""}`,
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

			// destructuring for identifiers
			const destructures = rootNode.findAll({ rule: { pattern: `const { ${key} } = ${varName}` } });
			for (const node of destructures) {
				const hadSemi = /;\s*$/.test(node.text());
				const replacement = replaceFn(varName, hadSemi);
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

			const directDestructures = rootNode.findAll({ rule: { pattern: `const { ${key} } = ${pattern}` } });
			for (const node of directDestructures) {
				const hadSemi = /;\s*$/.test(node.text());
				// Extract base expression text (the pattern text matches the whole RHS)
				const rhsText = node.text().replace(/^[^{]+{\s*[^}]+\s*}\s*=\s*/, "");
				const replacement = replaceFn(rhsText, hadSemi);
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

		const newURLDestructures = rootNode.findAll({ rule: { pattern: `const { ${key} } = new URL($ARG)` } });
		for (const node of newURLDestructures) {
			const hadSemi = /;\s*$/.test(node.text());
			const rhsText = node.text().replace(/^[^{]+{\s*[^}]+\s*}\s*=\s*/, "");
			const replacement = replaceFn(rhsText, hadSemi);
			edits.push(node.replace(replacement));
		}
	}

    if (!edits.length) return null;

    return rootNode.commitEdits(edits);
};

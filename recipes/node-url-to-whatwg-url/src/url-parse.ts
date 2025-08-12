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

    // Property access: obj.auth -> `${obj.username}:${obj.password}`
    const authAccesses = rootNode.findAll({ rule: { pattern: "$OBJ.auth" } });
    for (const node of authAccesses) {
        const base = node.getMatch("OBJ");
        if (!base) continue;

        const replacement = `\`\${${base.text()}.username}:\${${base.text()}.password}\``;
        edits.push(node.replace(replacement));
    }

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
		// Handle property access
		const propertyAccesses = rootNode.findAll({ rule: { pattern: `$OBJ.${key}` } });
		for (const node of propertyAccesses) {
			const base = node.getMatch("OBJ");
			if (!base) continue;

			let replacement = "";
			if (key === "auth") {
				replacement = `\`\${${base.text()}.username}:\${${base.text()}.password}\``;
			} else if (key === "path") {
				replacement = `\`\${${base.text()}.pathname}\${${base.text()}.search}\``;
			} else if (key === "hostname") {
				replacement = `${base.text()}.hostname.replace(/^\\[|\\]$/, '')`;
			}

			edits.push(node.replace(replacement));
		}

		// Handle destructuring
		const destructures = rootNode.findAll({ rule: { pattern: `const { ${key} } = $OBJ` } });
		for (const node of destructures) {
			const base = node.getMatch("OBJ");
			if (!base) continue;

			const hadSemi = /;\s*$/.test(node.text());
			const replacement = replaceFn(base.text(), hadSemi);
			edits.push(node.replace(replacement));
		}
	}

    if (!edits.length) return null;

    return rootNode.commitEdits(edits);
};

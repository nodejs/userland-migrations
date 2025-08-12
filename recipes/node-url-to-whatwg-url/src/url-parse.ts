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
    const authDestructures = rootNode.findAll({ rule: { pattern: "const { auth } = $OBJ" } });
    for (const node of authDestructures) {
        const base = node.getMatch("OBJ");
        if (!base) continue;
        const hadSemi = /;\s*$/.test(node.text());
        const name = base.text();
        const replacement = `const auth = \`${'${'}${name}.username${'}'}:${'${'}${name}.password${'}'}\`${hadSemi ? ';' : ''}`;
        edits.push(node.replace(replacement));
    }

    // Property access: obj.path -> `${obj.pathname}${obj.search}`
    const pathAccesses = rootNode.findAll({ rule: { pattern: "$OBJ.path" } });
    for (const node of pathAccesses) {
        const base = node.getMatch("OBJ");
        if (!base) continue;

        const replacement = `\`\${${base.text()}.pathname}\${${base.text()}.search}\``;
        edits.push(node.replace(replacement));
    }

    // Destructuring: const { path } = obj -> const path = `${obj.pathname}${obj.search}`
    const pathDestructures = rootNode.findAll({ rule: { pattern: "const { path } = $OBJ" } });
    for (const node of pathDestructures) {
        const base = node.getMatch("OBJ");
        if (!base) continue;
        const hadSemi = /;\s*$/.test(node.text());
        const name = base.text();
        const replacement = `const path = \`${'${'}${name}.pathname${'}'}${'${'}${name}.search${'}'}\`${hadSemi ? ';' : ''}`;
        edits.push(node.replace(replacement));
    }

    // Property access: obj.hostname -> obj.hostname.replace(/^\[|\]$/, '')
    const hostnameAccesses = rootNode.findAll({ rule: { pattern: "$OBJ.hostname" } });
    for (const node of hostnameAccesses) {
        const base = node.getMatch("OBJ");
        if (!base) continue;

        const replacement = `${base.text()}.hostname.replace(/^\\[|\\]$/, '')`;
        edits.push(node.replace(replacement));
    }

    // Destructuring: const { hostname } = obj -> const hostname = obj.hostname.replace(/^\[|\]$/, '')
    const hostnameDestructures = rootNode.findAll({ rule: { pattern: "const { hostname } = $OBJ" } });
    for (const node of hostnameDestructures) {
        const base = node.getMatch("OBJ");
        if (!base) continue;
        const hadSemi = /;\s*$/.test(node.text());
        const replacement = `const hostname = ${base.text()}.hostname.replace(/^\\[|\\]$/, '')${hadSemi ? ';' : ''}`;
        edits.push(node.replace(replacement));
    }

    if (!edits.length) return null;

    return rootNode.commitEdits(edits);
};

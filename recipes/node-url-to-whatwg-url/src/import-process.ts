import type { SgRoot, Edit, Range } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";
import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { removeLines } from "@nodejs/codemod-utils/ast-grep/remove-lines";

/**
 * Clean up unused imports/requires from 'node:url' after transforms using shared utils
 */
export default function transform(root: SgRoot<JS>): string | null {
    const rootNode = root.root();
    const edits: Edit[] = [];

    const isBindingUsed = (name: string): boolean => {
        const refs = rootNode.findAll({ rule: { pattern: name } });
        // Heuristic: declaration counts as one; any other usage yields > 1
        return refs.length > 1;
    };

    const linesToRemove: Range[] = [];

    // 1) ES Module imports: import ... from 'node:url'
    // @ts-ignore - ast-grep types vs jssg types
    const esmImports = getNodeImportStatements(root, "url");

    for (const imp of esmImports) {
        const clause = imp.find({ rule: { kind: "import_clause" } });
        let removed = false;
        if (clause) {
            const nsId = clause.find({ rule: { kind: "namespace_import" } })?.find({ rule: { kind: "identifier" } });
            if (nsId && !isBindingUsed(nsId.text())) {
                linesToRemove.push(imp.range());
                removed = true;
            }
            if (removed) continue;

            const specs = clause.findAll({ rule: { kind: "import_specifier" } });

            if (specs.length === 0 && !nsId) {
                const defaultId = clause.find({ rule: { kind: "identifier" } });
                if (defaultId && !isBindingUsed(defaultId.text())) {
                    linesToRemove.push(imp.range());
                    removed = true;
                }
                if (removed) continue;
            }

            if (specs.length > 0) {
                const keepTexts: string[] = [];
                for (const spec of specs) {
                    const text = spec.text().trim();
                    const bindingName = text.includes(" as ") ? text.split(/\s+as\s+/)[1] : text;
                    if (bindingName && isBindingUsed(bindingName)) keepTexts.push(text);
                }
                if (keepTexts.length === 0) {
                    linesToRemove.push(imp.range());
                } else if (keepTexts.length !== specs.length) {
                    const namedImportsNode = clause.find({ rule: { kind: "named_imports" } });
                    if (namedImportsNode) edits.push(namedImportsNode.replace(`{ ${keepTexts.join(", ")} }`));
                }
            }
        }
    }

    // 2) CommonJS requires: const ... = require('node:url')
    // @ts-ignore - ast-grep types vs jssg types
    const requireDecls = getNodeRequireCalls(root, "url");

    for (const decl of requireDecls) {
        const id = decl.find({ rule: { kind: "identifier" } });
        const hasObjectPattern = decl.find({ rule: { kind: "object_pattern" } });

        if (id && !hasObjectPattern) {
            if (!isBindingUsed(id.text())) linesToRemove.push(decl.parent().range());
            continue;
        }

        if (hasObjectPattern) {
            const names: string[] = [];
            const shorts = decl.findAll({ rule: { kind: "shorthand_property_identifier_pattern" } });
            for (const s of shorts) names.push(s.text());
            const pairs = decl.findAll({ rule: { kind: "pair_pattern" } });
            for (const pair of pairs) {
                const aliasId = pair.find({ rule: { kind: "identifier" } });
                if (aliasId) names.push(aliasId.text());
            }

            const usedTexts: string[] = [];
            for (const s of shorts) if (isBindingUsed(s.text())) usedTexts.push(s.text());
            for (const pair of pairs) {
                const aliasId = pair.find({ rule: { kind: "identifier" } });
                if (aliasId && isBindingUsed(aliasId.text())) usedTexts.push(pair.text());
            }

            if (usedTexts.length === 0) {
                linesToRemove.push(decl.parent().range());
            } else if (usedTexts.length !== names.length) {
                const objPat = decl.find({ rule: { kind: "object_pattern" } });
                if (objPat) edits.push(objPat.replace(`{ ${usedTexts.join(", ")} }`));
            }
        }
    }

    if (edits.length === 0 && linesToRemove.length === 0) return null;

    let source = rootNode.commitEdits(edits);

    source = removeLines(source, linesToRemove.map(range => ({
        start: { line: range.start.line, column: 0, index: 0 },
        end: { line: range.end.line + 1, column: 0, index: 0 }
    })));

    return source;
};

import { EOL } from "node:os";
import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";
import type { SgRoot, Edit, SgNode } from "@codemod.com/jssg-types/main";

const containsBuiltinProperties = (text: string): boolean =>
    text.includes("builtinModules") || text.includes("_builtinLibs");

/**
 * Transform function that converts deprecated repl.builtinModules and repl._builtinLibs
 * to module.builtinModules API.
 *
 * See https://nodejs.org/api/deprecations.html#DEP0191
 *
 * Handles:
 * 1. const repl = require('node:repl'); repl.builtinModules → const module = require('node:module'); module.builtinModules
 * 2. const { builtinModules } = require('node:repl'); → const { builtinModules } = require('node:module');
 * 3. const { builtinModules, foo } = require('node:repl'); → const { foo } = require('node:repl'); const { builtinModules } = require('node:module');
 * 4. import { builtinModules } from 'node:repl'; → import { builtinModules } from 'node:module';
 * 5. import { builtinModules, foo } from 'node:repl'; → import { foo } from 'node:repl'; import { builtinModules } from 'node:module';
 * 6. const repl = require('node:repl'); repl._builtinLibs → const module = require('node:module'); module.builtinModules
 * 7. const { _builtinLibs } = require('node:repl'); → const { builtinModules } = require('node:module');
 * 8. import { _builtinLibs } from 'node:repl'; → import { builtinModules } from 'node:module';
 */
export default function transform(root: SgRoot): string | null {
    const rootNode = root.root();
    const edits: Edit[] = [];
    // Reusable quoted module specifier for generating new statements
    const newModule = "'node:module'";

    const replaceStandaloneBuiltinLibsReferences = (): void => {
        const standaloneReferences = rootNode.findAll({
            rule: { pattern: "_builtinLibs" }
        });

        for (const ref of standaloneReferences) {
            const parent = ref.parent();

            if (
                parent
                && parent.kind() !== "object_pattern"
                && parent.kind() !== "member_expression"
                && parent.kind() !== "named_imports"
            ) {
                edits.push(ref.replace("builtinModules"));
            }
        }
    };

    const updateModuleSpecifier = (statement: SgNode): void => {
        const moduleSpecifier = statement.find({ rule: { kind: "string_fragment" } });

        if (moduleSpecifier) {
            // Always use 'node:module'
            edits.push(moduleSpecifier.replace('node:module'));
        }
    };

    // Step 1: Handle require statements
    const replRequireStatements = getNodeRequireCalls(root, "repl");

    for (const statement of replRequireStatements) {
        const objectPattern = statement.find({ rule: { kind: "object_pattern" } });

        if (objectPattern) {
            const originalText = objectPattern.text();

            if (containsBuiltinProperties(originalText)) {
                const properties = objectPattern.findAll({
                    rule: { kind: "shorthand_property_identifier_pattern" }
                });
                const pairProperties = objectPattern.findAll({
                    rule: { kind: "pair_pattern" }
                });

				// Check if only builtin properties are destructured
				const builtinShorthandCount = properties.filter(p =>
					containsBuiltinProperties(p.text())
				).length;

                const builtinPairCount = pairProperties.filter(p =>
                    containsBuiltinProperties(p.text())
                ).length;

                const totalBuiltinCount = builtinShorthandCount + builtinPairCount;
                const totalCount = properties.length + pairProperties.length;

                const isOnlyBuiltin = totalCount > 0 && totalBuiltinCount === totalCount;

                if (isOnlyBuiltin) {
                    // Replace entire require statement
                    updateModuleSpecifier(statement);

                    if (originalText.includes("_builtinLibs")) {
                        const newText = originalText.replace("_builtinLibs", "builtinModules");
                        edits.push(objectPattern.replace(newText));
                        replaceStandaloneBuiltinLibsReferences();
                    }
                } else {
                    // Split into two statements
                    const propertiesToKeep: string[] = [];
                    const builtinAliases: string[] = []; // Change to array to handle multiple aliases

                    for (const prop of properties) {
                        const propText = prop.text();
                        if (propText !== "builtinModules" && propText !== "_builtinLibs") {
                            propertiesToKeep.push(propText);
                        }
                    }

                    for (const prop of pairProperties) {
                        const propText = prop.text();

                        if (containsBuiltinProperties(propText)) {
                            // Extract alias from pair pattern like "builtinModules: alias" or "_builtinLibs: alias"
                            const keyNode = prop.find({ rule: { kind: "property_identifier" } });
                            const valueNode = prop.find({ rule: { kind: "identifier" } });

							if (
								keyNode &&
								valueNode &&
								containsBuiltinProperties(keyNode.text())
							) {
								builtinAliases.push(valueNode.text());
							}
                        } else {
                            propertiesToKeep.push(propText);
                        }
                    }

                    if (propertiesToKeep.length > 0) {
                        const variableDeclaration = statement.parent();
                        const moduleSpecifier = statement.find({ rule: { kind: "string" } });

                        if (variableDeclaration && moduleSpecifier) {
                            const currentModule = moduleSpecifier.text();

                            const reconstructedText = `{ ${propertiesToKeep.join(", ")} }`;
                            const firstStatement = `const ${reconstructedText} = require(${currentModule});`;

                            // Always use builtinModules without alias for the new module import
                            const secondStatement = `const { builtinModules } = require(${newModule});`;
                            const replacementText = `${firstStatement}${EOL}${secondStatement}`;

                            edits.push(variableDeclaration.replace(replacementText));

                            // Replace all alias references to use builtinModules
                            for (const alias of builtinAliases) {
                                const aliasReferences = rootNode.findAll({
                                    rule: { pattern: alias }
                                });

                                for (const ref of aliasReferences) {
                                    const parent = ref.parent();

                                    if (
                                        parent &&
                                        parent.kind() !== "object_pattern" &&
                                        parent.kind() !== "pair_pattern" &&
                                        parent.kind() !== "variable_declarator"
                                    ) {
                                        edits.push(ref.replace("builtinModules"));
                                    }
                                }
                            }

                            if (originalText.includes("_builtinLibs")) {
                                replaceStandaloneBuiltinLibsReferences();
                            }
                        }
                    }
                }
            }
        } else {
            // Handle namespace require (const repl = require('node:repl'))
            const variableDeclarator = statement.find({ rule: { kind: "variable_declarator" } });

            if (variableDeclarator) {
                const builtinModulesPath = resolveBindingPath(variableDeclarator, "$.builtinModules");
                const builtinLibsPath = resolveBindingPath(variableDeclarator, "$._builtinLibs");

                const usages = rootNode.findAll({
                    rule: {
                        any: [
                            { pattern: builtinModulesPath },
                            { pattern: builtinLibsPath }
                        ]
                    }
                });

                if (usages.length > 0) {
                    const identifier = variableDeclarator.find({
                        rule: { kind: "identifier" }
                    });

                    if (identifier) {
                        edits.push(identifier.replace("module"));
                        updateModuleSpecifier(statement);

                        for (const memberExpr of usages) {
                            edits.push(memberExpr.replace("module.builtinModules"));
                        }
                    }
                }
            }
        }
    }

    // Step 2: Handle import statements
    const replImportStatements = getNodeImportStatements(root, "repl");

    for (const statement of replImportStatements) {
        const namedImports = statement.find({ rule: { kind: "named_imports" } });

        if (namedImports) {
            const originalText = namedImports.text();

            if (containsBuiltinProperties(originalText)) {
                const importSpecifiers = namedImports.findAll({
                    rule: { kind: "import_specifier" }
                });

                const isOnlyBuiltin = importSpecifiers.length === 1 &&
                    containsBuiltinProperties(importSpecifiers[0].text());

                if (isOnlyBuiltin) {
                    // Replace entire import statement
                    updateModuleSpecifier(statement);

                    if (originalText.includes("_builtinLibs")) {
                        const newText = originalText.replace("_builtinLibs", "builtinModules");
                        edits.push(namedImports.replace(newText));
                        replaceStandaloneBuiltinLibsReferences();
                    }
                } else {
                    // Split into two statements
                    const newText = originalText
                        .replace(/,?\s*(builtinModules|_builtinLibs)\s*(as\s+\w+)?\s*,?/g, "")
                        .replace(/,\s*$/, "")
                        .replace(/^\s*,/, "");
                    edits.push(namedImports.replace(newText));

                    const moduleSpecifier = statement.find({ rule: { kind: "string" } });

                    if (moduleSpecifier) {
                        const aliasMatch = originalText.match(/(builtinModules|_builtinLibs)\s*(as\s+\w+)/);
                        const aliasText = aliasMatch ? ` ${aliasMatch[2]}` : "";
                        const newStatement = `import { builtinModules${aliasText} } from ${newModule};`;
                        const statementEnd = statement.range().end;

                        edits.push({
                            startPos: statementEnd.index,
                            endPos: statementEnd.index,
                            insertedText: `${EOL}${newStatement}`
                        });

                        if (originalText.includes("_builtinLibs") && !aliasText) {
                            replaceStandaloneBuiltinLibsReferences();
                        }
                    }
                }
            }
        } else {
            // Handle default/namespace imports
            const importClause = statement.find({ rule: { kind: "import_clause" } });
            if (!importClause) continue;

            // Use resolveBindingPath to determine how builtinModules should be accessed
            const builtinModulesPath = resolveBindingPath(importClause, "$.builtinModules");
            const builtinLibsPath = resolveBindingPath(importClause, "$._builtinLibs");

            const expressions = rootNode.findAll({
                rule: {
                    any: [
                        { pattern: builtinModulesPath },
                        { pattern: builtinLibsPath }
                    ]
                }
            });

            if (expressions.length > 0) {
                updateModuleSpecifier(statement);

                // Get the namespace identifier to maintain consistency
                let importIdentifier = importClause.find({ rule: { kind: "identifier" } });
                if (!importIdentifier) {
                    const namespaceImport = importClause.find({
                        rule: { kind: "namespace_import" }
                    });

                    if (namespaceImport) {
                        importIdentifier = namespaceImport.find({ rule: { kind: "identifier" } });
                    }
                }

                const varName = importIdentifier?.text() || "module";
                for (const memberExpr of expressions) {
                    edits.push(memberExpr.replace(`${varName}.builtinModules`));
                }
            }
        }
    }

    // Step 3: Handle dynamic imports
    const dynamicImportDeclarators = rootNode.findAll({
        rule: {
            kind: "variable_declarator",
            has: {
                field: "value",
                kind: "await_expression",
                has: {
                    kind: "call_expression",
                    all: [
                        {
                            has: {
                                field: "function",
                                kind: "import"
                            }
                        },
                        {
                            has: {
                                field: "arguments",
                                kind: "arguments",
                                has: {
                                    kind: "string",
                                    has: {
                                        kind: "string_fragment",
                                        regex: "(node:)?repl$"
                                    }
                                }
                            }
                        }
                    ]
                }
            }
        }
    });

    for (const variableDeclarator of dynamicImportDeclarators) {
        // Find the string fragment to replace
        const stringFragment = variableDeclarator.find({
            rule: {
                kind: "string_fragment",
                regex: "(node:)?repl$"
            }
        });

        if (stringFragment) {
            edits.push(stringFragment.replace("node:module"));
        }

        // Handle the variable assignment for dynamic imports
        const objectPattern = variableDeclarator.find({
            rule: { kind: "object_pattern" }
        });

        if (objectPattern) {
            // For cases like: const { builtinModules } = await import('node:repl');
            const originalText = objectPattern.text();
            if (containsBuiltinProperties(originalText)) {
                if (originalText.includes("_builtinLibs")) {
                    const newText = originalText.replace("_builtinLibs", "builtinModules");
                    edits.push(objectPattern.replace(newText));
                    replaceStandaloneBuiltinLibsReferences();
                }
            }
        } else {
            // For cases like: const repl = await import('node:repl');
            const identifier = variableDeclarator.find({
                rule: { kind: "identifier" }
            });

            if (identifier) {
                const builtinModulesPath = resolveBindingPath(variableDeclarator, "$.builtinModules");
                const builtinLibsPath = resolveBindingPath(variableDeclarator, "$._builtinLibs");

                const usages = rootNode.findAll({
                    rule: {
                        any: [
                            { pattern: builtinModulesPath },
                            { pattern: builtinLibsPath }
                        ]
                    }
                });

                if (usages.length > 0) {
                    // Replace variable name from 'repl' to 'module'
                    edits.push(identifier.replace("module"));

                    // Replace all usages to use builtinModules
                    for (const usage of usages) {
                        edits.push(usage.replace("module.builtinModules"));
                    }
                }
            }
        }
    }

    if (!edits.length) return null;

    return rootNode.commitEdits(edits);
}

import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import type { SgRoot, Edit } from "@codemod.com/jssg-types/main";
import type Js from "@codemod.com/jssg-types/langs/javascript";

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
export default function transform(root: SgRoot<Js>): string | null {
    const rootNode = root.root();
    let hasChanges = false;
    const edits: Edit[] = [];

    // Step 1: Handle require statements
    // @ts-ignore - ast-grep types are not fully compatible with JSSG types
    const replRequireStatements = getNodeRequireCalls(root, "repl");

    for (const statement of replRequireStatements) {
        // Check if this is destructuring assignment with builtinModules or _builtinLibs
        const objectPattern = statement.find({
            rule: {
                kind: "object_pattern"
            }
        });

        if (objectPattern) {
            const originalText = objectPattern.text();

            if (originalText.includes("builtinModules") || originalText.includes("_builtinLibs")) {
                // Check if builtinModules or _builtinLibs is the only destructured property
                const properties = objectPattern.findAll({
                    rule: {
                        kind: "shorthand_property_identifier_pattern"
                    }
                });

                const pairProperties = objectPattern.findAll({
                    rule: {
                        kind: "pair_pattern"
                    }
                });

                const hasOnlyBuiltinProperty = (properties.length === 1 &&
                    (properties[0].text() === "builtinModules" || properties[0].text() === "_builtinLibs")) ||
                    (properties.length === 0 && pairProperties.length === 1 &&
                    (pairProperties[0].text().includes("builtinModules") || pairProperties[0].text().includes("_builtinLibs")));

                if (hasOnlyBuiltinProperty) {
                    // Case 2/7: Replace entire require statement
                    const moduleSpecifier = statement.find({
                        rule: {
                            kind: "string"
                        }
                    });
                    if (moduleSpecifier) {
                        const currentModule = moduleSpecifier.text();
                        const newModule = currentModule.includes("node:") ? "'node:module'" : "'module'";
                        edits.push(moduleSpecifier.replace(newModule));

                        // If it was _builtinLibs, also rename it to builtinModules
                        if (originalText.includes("_builtinLibs")) {
                            edits.push(objectPattern.replace(originalText.replace("_builtinLibs", "builtinModules")));

                            // Also find and replace all standalone _builtinLibs references
                            const standaloneReferences = rootNode.findAll({
                                rule: {
                                    pattern: "_builtinLibs"
                                }
                            });

                            for (const ref of standaloneReferences) {
                                // Make sure it's not part of a member expression or destructuring
                                const parent = ref.parent();
                                if (parent && parent.kind() !== "object_pattern" && parent.kind() !== "member_expression") {
                                    edits.push(ref.replace("builtinModules"));
                                }
                            }
                        }
                        hasChanges = true;
                    }
                } else {
                    // Case 3: Split into two statements
                    const propertiesToKeep = [];
                    const properties = objectPattern.findAll({
                        rule: {
                            kind: "shorthand_property_identifier_pattern"
                        }
                    });

                    const pairProperties = objectPattern.findAll({
                        rule: {
                            kind: "pair_pattern"
                        }
                    });

                    // Collect properties that are not builtinModules or _builtinLibs
                    for (const prop of properties) {
                        const propText = prop.text();
                        if (propText !== "builtinModules" && propText !== "_builtinLibs") {
                            propertiesToKeep.push(propText);
                        }
                    }

                    for (const prop of pairProperties) {
                        const propText = prop.text();
                        if (!propText.includes("builtinModules") && !propText.includes("_builtinLibs")) {
                            propertiesToKeep.push(propText);
                        }
                    }

                    const reconstructedText = `{ ${propertiesToKeep.join(", ")} }`;

                    if (propertiesToKeep.length > 0) {
                        // Get the parent variable declaration to replace the entire statement
                        const variableDeclaration = statement.parent();

                        if (variableDeclaration && (variableDeclaration.kind() === "variable_declaration" || variableDeclaration.kind() === "lexical_declaration")) {
                            // Extract the alias if present
                            const aliasMatch = originalText.match(/(builtinModules|_builtinLibs)\s*:\s*(\w+)/);
                            const aliasText = aliasMatch ? `: ${aliasMatch[2]}` : "";

                            const moduleSpecifier = statement.find({
                                rule: {
                                    kind: "string"
                                }
                            });

                            if (moduleSpecifier) {
                                const currentModule = moduleSpecifier.text();
                                const newModule = currentModule.includes("node:") ? "node:module" : "module";

                                // Create the new statements
                                const firstStatement = `const ${reconstructedText} = require(${currentModule});`;
                                const secondStatement = `const { builtinModules${aliasText} } = require(${newModule.includes('node:') ? "'node:module'" : "'module'"});`;

                                // Replace the entire variable declaration with both statements
                                const replacementText = `${firstStatement}\n${secondStatement}`;

                                edits.push(variableDeclaration.replace(replacementText));

                                // If original had _builtinLibs, replace standalone references
                                if (originalText.includes("_builtinLibs") && !aliasText) {
                                    const standaloneReferences = rootNode.findAll({
                                        rule: {
                                            pattern: "_builtinLibs"
                                        }
                                    });

                                    for (const ref of standaloneReferences) {
                                        const parent = ref.parent();
                                        if (parent && parent.kind() !== "object_pattern" && parent.kind() !== "member_expression") {
                                            edits.push(ref.replace("builtinModules"));
                                        }
                                    }
                                }
                                hasChanges = true;
                            }
                        } else {
                            // Fallback to just replacing the object pattern
                            edits.push(objectPattern.replace(reconstructedText));
                        }
                    } else {
                        // If we're removing the entire destructuring, we need to remove the whole statement
                        edits.push(statement.replace(""));
                    }
                }
            }
        } else {
            // Case 1/6: Handle namespace import like const repl = require('node:repl')
            // Find usages of repl.builtinModules and repl._builtinLibs
            const variableDeclarator = statement.find({
                rule: {
                    kind: "variable_declarator"
                }
            });

            if (variableDeclarator) {
                const identifier = variableDeclarator.find({
                    rule: {
                        kind: "identifier"
                    }
                });

                if (identifier) {
                    const varName = identifier.text();

                    // Find all member expressions using this variable with builtinModules or _builtinLibs
                    const builtinModulesExpressions = rootNode.findAll({
                        rule: {
                            pattern: `${varName}.builtinModules`
                        }
                    });

                    const builtinLibsExpressions = rootNode.findAll({
                        rule: {
                            pattern: `${varName}._builtinLibs`
                        }
                    });

                    if (builtinModulesExpressions.length > 0 || builtinLibsExpressions.length > 0) {
                        // Replace variable name from repl to module
                        edits.push(identifier.replace("module"));

                        // Replace all member expressions
                        for (const memberExpr of builtinModulesExpressions) {
                            edits.push(memberExpr.replace("module.builtinModules"));
                        }

                        for (const memberExpr of builtinLibsExpressions) {
                            edits.push(memberExpr.replace("module.builtinModules"));
                        }

                        // Replace require statement to use module instead
                        const moduleSpecifier = statement.find({
                            rule: {
                                kind: "string"
                            }
                        });
                        if (moduleSpecifier) {
                            const currentModule = moduleSpecifier.text();
                            const newModule = currentModule.includes("node:") ? "'node:module'" : "'module'";
                            edits.push(moduleSpecifier.replace(newModule));
                            hasChanges = true;
                        }
                    }
                }
            }
        }
    }

    // Step 2: Handle import statements
    // @ts-ignore - ast-grep types are not fully compatible with JSSG types
    const replImportStatements = getNodeImportStatements(root, "repl");

    for (const statement of replImportStatements) {
        // Handle named imports like: import { builtinModules, _builtinLibs } from 'node:repl'
        const namedImports = statement.find({
            rule: {
                kind: "named_imports"
            }
        });

        if (namedImports) {
            const originalText = namedImports.text();

            if (originalText.includes("builtinModules") || originalText.includes("_builtinLibs")) {
                // Check if builtinModules or _builtinLibs is the only import
                const importSpecifiers = namedImports.findAll({
                    rule: {
                        kind: "import_specifier"
                    }
                });

                const hasOnlyBuiltinProperty = importSpecifiers.length === 1 &&
                    (importSpecifiers[0].text().includes("builtinModules") || importSpecifiers[0].text().includes("_builtinLibs"));

                if (hasOnlyBuiltinProperty) {
                    // Case 4/8: Replace entire import statement
                    const moduleSpecifier = statement.find({
                        rule: {
                            kind: "string"
                        }
                    });
                    if (moduleSpecifier) {
                        const currentModule = moduleSpecifier.text();
                        const newModule = currentModule.includes("node:") ? "'node:module'" : "'module'";
                        edits.push(moduleSpecifier.replace(newModule));

                        // If it was _builtinLibs, also rename it to builtinModules
                        if (originalText.includes("_builtinLibs")) {
                            edits.push(namedImports.replace(originalText.replace("_builtinLibs", "builtinModules")));

                            // Also find and replace all standalone _builtinLibs references
                            const standaloneReferences = rootNode.findAll({
                                rule: {
                                    pattern: "_builtinLibs"
                                }
                            });

                            for (const ref of standaloneReferences) {
                                const parent = ref.parent();
                                if (parent && parent.kind() !== "named_imports" && parent.kind() !== "member_expression") {
                                    edits.push(ref.replace("builtinModules"));
                                }
                            }
                        }
                        hasChanges = true;
                    }
                } else {
                    // Case 5: Split into two statements
                    const newText = originalText.replace(/,?\s*(builtinModules|_builtinLibs)\s*(as\s+\w+)?\s*,?/g, "")
                        .replace(/,\s*$/, "").replace(/^\s*,/, "");
                    edits.push(namedImports.replace(newText));

                    // Add new module import statement
                    const moduleSpecifier = statement.find({
                        rule: {
                            kind: "string"
                        }
                    });
                    if (moduleSpecifier) {
                        const currentModule = moduleSpecifier.text();
                        const newModule = currentModule.includes("node:") ? "node:module" : "module";

                        // Extract the alias if present (for both builtinModules and _builtinLibs)
                        const aliasMatch = originalText.match(/(builtinModules|_builtinLibs)\s*(as\s+\w+)/);
                        const aliasText = aliasMatch ? ` ${aliasMatch[2]}` : "";

                        const newStatement = `import { builtinModules${aliasText} } from ${newModule.includes("node:") ? "'node:module'" : "'module'"};`;

                        // Insert after current statement
                        const statementEnd = statement.range().end;
                        edits.push({
                            startPos: statementEnd.index,
                            endPos: statementEnd.index,
                            insertedText: `\n${newStatement}`
                        });

                        // If original had _builtinLibs without alias, replace standalone references
                        if (originalText.includes("_builtinLibs") && !aliasText) {
                            const standaloneReferences = rootNode.findAll({
                                rule: {
                                    pattern: "_builtinLibs"
                                }
                            });

                            for (const ref of standaloneReferences) {
                                const parent = ref.parent();
                                if (parent && parent.kind() !== "named_imports" && parent.kind() !== "member_expression") {
                                    edits.push(ref.replace("builtinModules"));
                                }
                            }
                        }
                        hasChanges = true;
                    }
                }
            }
        }

        // Handle default imports like: import repl from 'node:repl'
        // Handle namespace imports like: import * as repl from 'node:repl'
        if (!namedImports) {
            // Look for default or namespace imports that use repl.builtinModules or repl._builtinLibs
            const importClause = statement.find({
                rule: {
                    kind: "import_clause"
                }
            });

            if (importClause) {
                let importIdentifier = null;

                // Check for default import
                const defaultImport = importClause.find({
                    rule: {
                        kind: "identifier"
                    }
                });

                // Check for namespace import
                const namespaceImport = importClause.find({
                    rule: {
                        kind: "namespace_import"
                    }
                });

                if (defaultImport) {
                    importIdentifier = defaultImport;
                } else if (namespaceImport) {
                    const namespaceIdentifier = namespaceImport.find({
                        rule: {
                            kind: "identifier"
                        }
                    });
                    if (namespaceIdentifier) {
                        importIdentifier = namespaceIdentifier;
                    }
                }

                if (importIdentifier) {
                    const varName = importIdentifier.text();

                    // Find all member expressions using this variable with builtinModules or _builtinLibs
                    const builtinModulesExpressions = rootNode.findAll({
                        rule: {
                            pattern: `${varName}.builtinModules`
                        }
                    });

                    const builtinLibsExpressions = rootNode.findAll({
                        rule: {
                            pattern: `${varName}._builtinLibs`
                        }
                    });

                    if (builtinModulesExpressions.length > 0 || builtinLibsExpressions.length > 0) {
                        // Replace the import to use module instead
                        const moduleSpecifier = statement.find({
                            rule: {
                                kind: "string"
                            }
                        });
                        if (moduleSpecifier) {
                            const currentModule = moduleSpecifier.text();
                            const newModule = currentModule.includes("node:") ? "'node:module'" : "'module'";
                            edits.push(moduleSpecifier.replace(newModule));
                            hasChanges = true;
                        }

                        // Replace all _builtinLibs usages with builtinModules
                        for (const memberExpr of builtinLibsExpressions) {
                            edits.push(memberExpr.replace(`${varName}.builtinModules`));
                        }
                    }
                }
            }
        }
    }

    if (!hasChanges) return null;

    return rootNode.commitEdits(edits);
}

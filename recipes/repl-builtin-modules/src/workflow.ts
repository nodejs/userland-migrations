import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import type { SgRoot, Edit } from "@codemod.com/jssg-types/main";
import type Js from "@codemod.com/jssg-types/langs/javascript";

/**
 * Transform function that converts deprecated repl.builtinModules
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
 */
export default function transform(root: SgRoot<Js>): string | null {
    const rootNode = root.root();
    let hasChanges = false;
    const edits: Edit[] = [];

    // Step 1: Handle require statements
    // @ts-ignore - ast-grep types are not fully compatible with JSSG types
    const replRequireStatements = getNodeRequireCalls(root, "repl");

    for (const statement of replRequireStatements) {
        // Check if this is destructuring assignment with builtinModules
        const objectPattern = statement.find({
            rule: {
                kind: "object_pattern"
            }
        });

        if (objectPattern) {
            const originalText = objectPattern.text();

            if (originalText.includes("builtinModules")) {
                // Check if builtinModules is the only destructured property
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

                const hasOnlyBuiltinModules = (properties.length === 1 && properties[0].text() === "builtinModules") ||
                    (properties.length === 0 && pairProperties.length === 1 && pairProperties[0].text().includes("builtinModules"));

                if (hasOnlyBuiltinModules) {
                    // Case 2: Replace entire require statement
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
                } else {
                    // Case 3: Split into two statements
                    const newText = originalText.replace(/,?\s*builtinModules\s*(:\s*\w+)?\s*,?/g, "").replace(/,\s*$/, "").replace(/^\s*,/, "");

                    if (newText !== "{ }") {
                        // Get the parent variable declaration to replace the entire statement
                        const variableDeclaration = statement.parent();

                        if (variableDeclaration && (variableDeclaration.kind() === "variable_declaration" || variableDeclaration.kind() === "lexical_declaration")) {
                            // Extract the alias if present
                            const aliasMatch = originalText.match(/builtinModules\s*:\s*(\w+)/);
                            const aliasText = aliasMatch ? `: ${aliasMatch[1]}` : "";

                            const moduleSpecifier = statement.find({
                                rule: {
                                    kind: "string"
                                }
                            });

                            if (moduleSpecifier) {
                                const currentModule = moduleSpecifier.text();
                                const newModule = currentModule.includes("node:") ? "node:module" : "module";

                                // Create the new statements
                                const firstStatement = `const ${newText} = require(${currentModule});`;
                                const secondStatement = `const { builtinModules${aliasText} } = require(${newModule.includes('node:') ? "'node:module'" : "'module'"});`;

                                // Replace the entire variable declaration with both statements
                                const replacementText = `${firstStatement}\n${secondStatement}`;

                                edits.push(variableDeclaration.replace(replacementText));
                                hasChanges = true;
                            }
                        } else {
                            // Fallback to just replacing the object pattern
                            edits.push(objectPattern.replace(newText));
                        }
                    } else {
                        // If we're removing the entire destructuring, we need to remove the whole statement
                        edits.push(statement.replace(""));
                    }
                }
            }
        } else {
            // Case 1: Handle namespace import like const repl = require('node:repl')
            // Find usages of repl.builtinModules and replace with module.builtinModules
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

                    // Find all member expressions using this variable with builtinModules
                    const memberExpressions = rootNode.findAll({
                        rule: {
                            pattern: `${varName}.builtinModules`
                        }
                    });

                    if (memberExpressions.length > 0) {
                        // Replace variable name from repl to module
                        edits.push(identifier.replace("module"));

                        // Replace all member expressions
                        for (const memberExpr of memberExpressions) {
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
        // Handle named imports like: import { builtinModules } from 'node:repl'
        const namedImports = statement.find({
            rule: {
                kind: "named_imports"
            }
        });

        if (namedImports) {
            const originalText = namedImports.text();

            if (originalText.includes("builtinModules")) {
                // Check if builtinModules is the only import
                const importSpecifiers = namedImports.findAll({
                    rule: {
                        kind: "import_specifier"
                    }
                });

                const hasOnlyBuiltinModules = importSpecifiers.length === 1 &&
                    importSpecifiers[0].text().includes("builtinModules");

                if (hasOnlyBuiltinModules) {
                    // Case 4: Replace entire import statement
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
                } else {
                    // Case 5: Split into two statements
                    const newText = originalText.replace(/,?\s*builtinModules\s*(:\s*\w+)?\s*,?/g, "").replace(/,\s*$/, "").replace(/^\s*,/, "");
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

                        // Extract the alias if present
                        const aliasMatch = originalText.match(/builtinModules\s*(as\s+\w+)/);
                        const aliasText = aliasMatch ? ` ${aliasMatch[1]}` : "";

                        const newStatement = `import { builtinModules${aliasText} } from ${newModule.includes("node:") ? "'node:module'" : "'module'"};`;

                        // Insert after current statement
                        const statementEnd = statement.range().end;
                        edits.push({
                            startPos: statementEnd.index,
                            endPos: statementEnd.index,
                            insertedText: `\n${newStatement}`
                        });
                        hasChanges = true;
                    }
                }
            }
        }

        // Handle default imports like: import repl from 'node:repl'
        // Handle namespace imports like: import * as repl from 'node:repl'
        if (!namedImports) {
            // Look for default or namespace imports that use repl.builtinModules
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

                    // Find all member expressions using this variable with builtinModules
                    const memberExpressions = rootNode.findAll({
                        rule: {
                            pattern: `${varName}.builtinModules`
                        }
                    });

                    if (memberExpressions.length > 0) {
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
                    }
                }
            }
        }
    }

    if (!hasChanges) return null;

    return rootNode.commitEdits(edits);
}

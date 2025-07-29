import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import type { SgRoot, Edit } from "@codemod.com/jssg-types/main";
import type Js from "@codemod.com/jssg-types/langs/javascript";

/**
 * Transform function that converts deprecated repl.builtinModules
 * to module.builtinModules API.
 *
 * Handles:
 * 1. const repl = require('node:repl'); repl.builtinModules -> const module = require('node:module'); module.builtinModules
 * 2. const { builtinModules } = require('node:repl'); -> const { builtinModules } = require('node:module');
 * 3. const { builtinModules, foo } = require('node:repl'); -> const { foo } = require('node:repl'); const { builtinModules } = require('node:module');
 * 4. import { builtinModules } from 'node:repl'; -> import { builtinModules } from 'node:module';
 * 5. import { builtinModules, foo } from 'node:repl'; -> import { foo } from 'node:repl'; import { builtinModules } from 'node:module';
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

                const hasOnlyBuiltinModules = properties.length === 1 &&
                    properties[0].text() === "builtinModules";

                if (hasOnlyBuiltinModules) {
                    // Case 2: Replace entire require statement
                    const moduleSpecifier = statement.find({
                        rule: {
                            kind: "string"
                        }
                    });
                    if (moduleSpecifier) {
                        const currentModule = moduleSpecifier.text();
                        const newModule = currentModule.includes("node:") ? '"node:module"' : '"module"';
                        edits.push(moduleSpecifier.replace(newModule));
                        hasChanges = true;
                    }
                } else {
                    // Case 3: Split into two statements
                    const newText = originalText.replace(/,?\s*builtinModules\s*,?/g, "").replace(/,\s*$/, "").replace(/^\s*,/, "");

                    if (newText !== "{ }") {
                        edits.push(objectPattern.replace(newText));
                    }

                    // Add new module require statement
                    const moduleSpecifier = statement.find({
                        rule: {
                            kind: "string"
                        }
                    });
                    if (moduleSpecifier) {
                        const currentModule = moduleSpecifier.text();
                        const newModule = currentModule.includes("node:") ? "node:module" : "module";
                        const newStatement = `const { builtinModules } = require(${newModule.includes("node:") ? '"node:module"' : '"module"'});`;

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
                        // Replace require statement to use module instead
                        const moduleSpecifier = statement.find({
                            rule: {
                                kind: "string"
                            }
                        });
                        if (moduleSpecifier) {
                            const currentModule = moduleSpecifier.text();
                            const newModule = currentModule.includes("node:") ? '"node:module"' : '"module"';
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
                        const newModule = currentModule.includes("node:") ? '"node:module"' : '"module"';
                        edits.push(moduleSpecifier.replace(newModule));
                        hasChanges = true;
                    }
                } else {
                    // Case 5: Split into two statements
                    const newText = originalText.replace(/,?\s*builtinModules\s*,?/g, "").replace(/,\s*$/, "").replace(/^\s*,/, "");
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
                        const newStatement = `import { builtinModules } from ${newModule.includes("node:") ? '"node:module"' : '"module"'};`;

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
    }

    if (!hasChanges) return null;

    return rootNode.commitEdits(edits);
}

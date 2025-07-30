import { EOL } from "node:os";
import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";
import type { SgRoot, Edit, SgNode } from "@codemod.com/jssg-types/main";
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

    // Helper functions
    const getNewModuleSpecifier = (currentModule: string): string =>
        currentModule.includes("node:") ? "'node:module'" : "'module'";

    const containsBuiltinProperties = (text: string): boolean =>
        text.includes("builtinModules") || text.includes("_builtinLibs");

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
        const moduleSpecifier = statement.find({ rule: { kind: "string" } });

        if (moduleSpecifier) {
            const currentModule = moduleSpecifier.text();
            const newModule = getNewModuleSpecifier(currentModule);
            edits.push(moduleSpecifier.replace(newModule));
        }
    };

    // Step 1: Handle require statements
    // @ts-ignore - ast-grep types are not fully compatible with JSSG types
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
				const isOnlyBuiltin = (
					properties.length === 1 &&
					["builtinModules", "_builtinLibs"].includes(properties[0].text())
				) || (
					properties.length === 0 &&
					pairProperties.length === 1 &&
					containsBuiltinProperties(pairProperties[0].text())
				);

                if (isOnlyBuiltin) {
                    // Replace entire require statement
                    updateModuleSpecifier(statement);

                    if (originalText.includes("_builtinLibs")) {
                        //edits.push(objectPattern.replace(originalText.replace("_builtinLibs", "builtinModules")));
						const newText = originalText.replace("_builtinLibs", "builtinModules");
						edits.push(objectPattern.replace(newText));
						replaceStandaloneBuiltinLibsReferences();
					}
                    hasChanges = true;
                } else {
                    // Split into two statements
                    const propertiesToKeep = [];

                    for (const prop of properties) {
                        const propText = prop.text();
                        if (propText !== "builtinModules" && propText !== "_builtinLibs") {
                            propertiesToKeep.push(propText);
                        }
                    }

                    for (const prop of pairProperties) {
                        const propText = prop.text();
                        if (!containsBuiltinProperties(propText)) {
                            propertiesToKeep.push(propText);
                        }
                    }

                    if (propertiesToKeep.length > 0) {
                        const variableDeclaration = statement.parent();
                        const moduleSpecifier = statement.find({ rule: { kind: "string" } });

                        if (variableDeclaration && moduleSpecifier) {
                            const currentModule = moduleSpecifier.text();
                            const newModule = getNewModuleSpecifier(currentModule);

                            const aliasMatch = originalText.match(/(builtinModules|_builtinLibs)\s*:\s*(\w+)/);
                            const aliasText = aliasMatch ? `: ${aliasMatch[2]}` : "";

                            const reconstructedText = `{ ${propertiesToKeep.join(", ")} }`;
                            const firstStatement = `const ${reconstructedText} = require(${currentModule});`;
                            const secondStatement = `const { builtinModules${aliasText} } = require(${newModule});`;
                            const replacementText = `${firstStatement}${EOL}${secondStatement}`;

                            edits.push(variableDeclaration.replace(replacementText));

                            if (originalText.includes("_builtinLibs") && !aliasText) {
                                replaceStandaloneBuiltinLibsReferences();
                            }
                            hasChanges = true;
                        }
                    }
                }
            }
        } else {
            // Handle namespace require (const repl = require('node:repl'))
            const variableDeclarator = statement.find({ rule: { kind: "variable_declarator" } });

            if (variableDeclarator) {
				// Use resolveBindingPath to determine how builtinModules should be accessed
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
						hasChanges = true;
					}
				}
            }
        }
    }

    // Step 2: Handle import statements
    // @ts-ignore - ast-grep types are not fully compatible with JSSG types
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
                    hasChanges = true;
                } else {
                    // Split into two statements
                    const newText = originalText
						.replace(/,?\s*(builtinModules|_builtinLibs)\s*(as\s+\w+)?\s*,?/g, "")
                        .replace(/,\s*$/, "").replace(/^\s*,/, "");
                    edits.push(namedImports.replace(newText));

                    const moduleSpecifier = statement.find({ rule: { kind: "string" } });
                    if (moduleSpecifier) {
                        const currentModule = moduleSpecifier.text();
                        const newModule = getNewModuleSpecifier(currentModule);

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
                        hasChanges = true;
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
				hasChanges = true;
			}
        }
    }

	if (!hasChanges) return null;

    return rootNode.commitEdits(edits);
}

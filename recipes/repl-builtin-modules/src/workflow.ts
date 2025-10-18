import { EOL } from "node:os";
import { getNodeImportCalls, getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";
import type { SgRoot, Edit, SgNode } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";

/**
 * Regex to match deprecated properties
 *
 * _builtinLibs and builtinModules
 */
const builtinRegex = /\b(_builtinLibs|builtinModules)\b/g;

// Reusable quoted module specifier for generating new statements
const newModule = "'node:module'";

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
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

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
					handleRequireObjectPatternWithOnlyBuiltin(
						statement,
						objectPattern,
						originalText,
						rootNode,
						edits
					);
				} else {
					handleRequireObjectPatternWithMixedBuiltin(
						statement,
						properties,
						pairProperties,
						originalText,
						rootNode,
						edits
					);
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
						updateModuleSpecifier(statement, edits);

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
					updateModuleSpecifier(statement, edits);

					if (originalText.includes("_builtinLibs")) {
						const newText = originalText.replace("_builtinLibs", "builtinModules");
						edits.push(namedImports.replace(newText));
						replaceStandaloneBuiltinLibsReferences(rootNode, edits);
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
							replaceStandaloneBuiltinLibsReferences(rootNode, edits);
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
				updateModuleSpecifier(statement, edits);

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
	const dynamicImportDeclarators = getNodeImportCalls(root, "repl");

	for (const variableDeclarator of dynamicImportDeclarators) {
		// Find the string fragment to replace
		const stringFragment = variableDeclarator.find({
			rule: { kind: "string_fragment" }
		});

		if (stringFragment) edits.push(stringFragment.replace("node:module"));


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
					replaceStandaloneBuiltinLibsReferences(rootNode, edits);
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
};

/**
 * Handles the transformation of require statements with object patterns
 * that only contain built-in libraries.
 *
 * @param statement - The original require statement.
 * @param objectPattern - The object pattern containing the built-in libraries.
 * @param originalText - The original text of the require statement.
 * @param rootNode - The root node of the AST.
 * @param edits - The list of edits to apply.
 */
const handleRequireObjectPatternWithOnlyBuiltin = (
	statement: SgNode<JS>,
	objectPattern: SgNode<JS>,
	originalText: string,
	rootNode: SgNode<JS>,
	edits: Edit[]
): void => {
	// Replace entire require statement
	updateModuleSpecifier(statement, edits);

	if (originalText.includes("_builtinLibs")) {
		if (builtinRegex.test(originalText)) {
			const replacedText = originalText.replace(builtinRegex, "builtinModules");
			edits.push(objectPattern.replace(replacedText));
			replaceStandaloneBuiltinLibsReferences(rootNode, edits);
		}

		const builtinLibsReplacedText = originalText.replace("_builtinLibs", "builtinModules");
		edits.push(objectPattern.replace(builtinLibsReplacedText));
		replaceStandaloneBuiltinLibsReferences(rootNode, edits);
	}
};

/**
 * Handles the transformation of require statements with object patterns
 * that contain both built-in and user-defined libraries.
 *
 * @param statement - The original require statement.
 * @param properties - The properties of the object pattern.
 * @param pairProperties - The pair properties of the object pattern.
 * @param originalText - The original text of the require statement.
 * @param rootNode - The root node of the AST.
 * @param edits - The list of edits to apply.
 */
const handleRequireObjectPatternWithMixedBuiltin = (
	statement: SgNode<JS>,
	properties: SgNode<JS>[],
	pairProperties: SgNode<JS>[],
	originalText: string,
	rootNode: SgNode<JS>,
	edits: Edit[]
): void => {
	// Split into two statements
	const propertiesToKeep: string[] = [];
	const builtinAliases: string[] = [];

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

	if (propertiesToKeep.length === 0) return;

	const variableDeclaration = statement.parent();
	const moduleSpecifier = statement.find({ rule: { kind: "string" } });

	if (!variableDeclaration || !moduleSpecifier) return;

	const currentModule = moduleSpecifier.text();
	const reconstructedText = `{ ${propertiesToKeep.join(", ")} }`;
	const firstStatement = `const ${reconstructedText} = require(${currentModule});`;
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
		replaceStandaloneBuiltinLibsReferences(rootNode, edits);
	}
};

/**
 * Replace standalone references to _builtinLibs with builtinModules
 *
 * @param rootNode - The root node of the AST.
 * @param edits - The list of edits to apply.
 */
const replaceStandaloneBuiltinLibsReferences = (rootNode: SgNode<JS>, edits: Edit[]): void => {
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

/**
 * Checks if the given text contains references to built-in properties.
 *
 * @param text - The text to check.
 * @returns True if the text contains built-in properties, false otherwise.
 */
const containsBuiltinProperties = (text: string): boolean =>
	text.includes("builtinModules") || text.includes("_builtinLibs");

/**
 * Update the module specifier in the given statement to 'node:module'.
 *
 * @param statement - The AST node representing the import or require statement.
 * @param edits - The list of edits to apply.
 */
const updateModuleSpecifier = (statement: SgNode<JS>, edits: Edit[]): void => {
	const moduleSpecifier = statement.find({ rule: { kind: "string_fragment" } });

	if (moduleSpecifier) {
		// Always use 'node:module'
		edits.push(moduleSpecifier.replace('node:module'));
	}
};

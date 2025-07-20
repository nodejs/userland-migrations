import type { SgRoot, SgNode } from '@ast-grep/napi';

/**
 *  We just catch `variable_declarator` nodes that use `require` to import a module
 *  Because a simple `require('nodeAPI')` don't do anything, so in codemod context we don't need to
 *  catch those.
 *  We also catch `require` calls that are not assigned to a variable, like `const fs = require('fs');`
 */
export const getNodeRequireCalls = (rootNode: SgRoot, nodeModuleName: string): SgNode[] =>
	rootNode
		.root()
		.findAll({
			rule: {
				kind: "variable_declarator",
				all: [
					{
						has: {
							field: "name",
							any: [
								{ kind: "object_pattern" },
								{ kind: "identifier" }
							]
						}
					},
					{
						has: {
							field: "value",
							kind: "call_expression",
							all: [
								{
									has: {
										field: "function",
										kind: "identifier",
										regex: "^require$"
									}
								},
								{
									has: {
										field: "arguments",
										kind: "arguments",
										has: {
											kind: "string",
											regex: `^['"](node:)?${nodeModuleName}['"]$`
										}
									}
								}
							]
						}
					}
				]
			}
		});

/**
 * Check if the require call is a spread import statement.
 * This is used to determine if the import statement has a named_imports node anywhere in its structure.
 * This covers cases like:
 * `const { readFile } = require('fs');` → `true`
 * `const { readFile: read } = require('fs');` → `true`
 * `const fs = require('fs');` → `false`
 * `const fs = require('fs').promises;` → `false`
 * `const {} = require('fs');` → `true`
 * `const { a, b, c } = require('module');` → `true
 */
export const isSpreadRequire = (node: SgNode): boolean => {
	if(node.kind() !== "variable_declarator") return false;

	// Check if the variable declarator has an object_pattern in its name field
	// This indicates destructuring assignment like: const { readFile } = require('fs')
	const nameField = node.field('name');
	if (!nameField) return false;

	return nameField.kind() === 'object_pattern';
};

import type { SgRoot, SgNode } from '@ast-grep/napi';

export const getNodeImportStatements = (rootNode: SgRoot, nodeModuleName: string): SgNode[] =>
	rootNode
		.root()
		.findAll({
			rule: {
				kind: "import_statement",
				has: {
					field: "source",
					kind: "string",
					regex: `^['"](node:)?${nodeModuleName}['"]$`
				}
			}
		});

/**
 * This function take an `import_statment` and return true if it's spead import statement.
 * For example:
 * `import { readFile } from 'fs';` → `true`
 * `import { readFile as read } from 'fs';` → `true`
 * `import * as fs from 'fs';` → `false`
 * `import fs from 'fs';` → `false`
 */
export const isImportStatementSpread = (node: SgNode): boolean => {
	if (node.kind() !== "import_statement") {
		return false;
	}

	// Check if the import statement has a named_imports node anywhere in its structure
	// This covers cases like: import { readFile }, import { readFile as read }, import {}
	return node.find({ rule: { kind: 'named_imports' } }) !== null;
};

/**
 * We just catch `variable_declarator` nodes that use `import` to import a module
 * Because a simple `import('nodeAPI')` don't do anything, so in codemod context we don't need to
 * catch those.
 *
 * We also don't catch pending promises, like `const pending = import("node:module");`
 * because it's will became to complex to handle in codemod context. (storing var name, checking is method is used, etc.)
 */
export const getNodeImportCalls = (rootNode: SgRoot, nodeModuleName: string): SgNode[] =>
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
											regex: `^['"](node:)?${nodeModuleName}['"]$`
										}
									}
								}
							]
						}
					}
				}
			]
		}
	});

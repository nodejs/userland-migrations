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

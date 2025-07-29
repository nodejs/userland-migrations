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
 * Get the default import identifier from an import statement
 */
export const getDefaultImportIdentifier = (importNode: SgNode): SgNode | null =>
	importNode.find({
		rule: {
			kind: "identifier",
			inside: {
				kind: "import_clause",
				not: {
					has: {
						kind: "named_imports"
					}
				}
			}
		}
	});

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

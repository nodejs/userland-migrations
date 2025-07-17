import type { SgRoot, SgNode } from '@ast-grep/napi';

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

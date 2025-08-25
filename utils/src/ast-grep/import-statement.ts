import type { SgRoot, SgNode } from "@codemod.com/jssg-types/main";

export const getNodeImportStatements = (rootNode: SgRoot, nodeModuleName: string): SgNode[] =>
	rootNode.root().findAll({
		rule: {
			kind: "import_statement",
			has: {
				field: "source",
				kind: "string",
				has: {
					kind: "string_fragment",
					regex: `(node:)?${nodeModuleName}$`,
				},
			},
		},
	});

/**
 * We just catch `variable_declarator` nodes that use `import` to import a module
 * Because a simple `import('nodeAPI')` don't do anything, so in codemod context we don't need to
 * catch those.
 *
 * We also don't catch pending promises, like `const pending = import("node:module");`
 * because it's will became to complex to handle in codemod context. (storing var name, checking is method is used, etc.)
 */
export const getNodeImportCalls = (rootNode: SgRoot, nodeModuleName: string): SgNode[] => {
	const nodes = rootNode.root().findAll({
		rule: {
			kind: "variable_declarator",
			all: [
				{
					has: {
						field: "name",
						any: [{ kind: "object_pattern" }, { kind: "identifier" }],
					},
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
										kind: "import",
									},
								},
								{
									has: {
										field: "arguments",
										kind: "arguments",
										has: {
											kind: "string",
											has: {
												kind: "string_fragment",
												regex: `(node:)?${nodeModuleName}$`,
											},
										},
									},
								},
							],
						},
					},
				},
			],
		},
	});

	const variableDeclarator = rootNode.root().findAll({
		rule: {
			kind: "identifier",
			inside: {
				kind: "variable_declarator",
				has: {
					kind: "string",
					has: {
						kind: "string_fragment",
						regex: `(node:)?${nodeModuleName}$`,
					},
				},
			},
		},
	});

	const variablesRules = variableDeclarator.map((variableName) => ({
		has: {
			kind: "identifier",
			regex: variableName.text(),
		},
	}));

	const dynamicImports = rootNode.root().findAll({
		rule: {
			kind: "call_expression",
			all: [
				{
					has: {
						field: "function",
						kind: "import",
					},
				},
				{
					has: {
						field: "arguments",
						kind: "arguments",
						any: [
							{
								has: {
									kind: "string",
									has: {
										kind: "string_fragment",
										regex: `^(node:)?${nodeModuleName}$`,
									},
								},
							},
							...variablesRules,
						],
					},
				},
			],
		},
	});

	for (const node of dynamicImports) {
		let parentNode = node.parent();
		// iterate through all chained methods until reaching the expression_statement
		// that marks the beginning of the import line
		while (parentNode !== null && parentNode.kind() !== "expression_statement") {
			parentNode = parentNode.parent();
		}

		// if it is a valid import add to list of nodes that will be retuned
		if (parentNode?.kind() === "expression_statement") {
			const thenBlock = parentNode.find({
				rule: {
					kind: "member_expression",
					has: {
						kind: "property_identifier",
						regex: "then",
					},
				},
			});

			if (thenBlock !== null) {
				nodes.push(parentNode);
			}
		}
	}

	return nodes;
};

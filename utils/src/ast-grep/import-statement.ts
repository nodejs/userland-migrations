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

export const getNodeImportCalls = (rootNode: SgRoot, nodeModuleName: string): SgNode[] => {
	const results: SgNode[] = [];

	// Find variable declarators with direct import calls
	const directImports = rootNode
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
				]
			}
		});

	// Extract the call_expression from direct imports
	directImports.forEach(declarator => {
		const callExpr = declarator.field('value');
		if (callExpr) {
			results.push(callExpr);
		}
	});

	// Find variable declarators with await import calls
	const awaitImports = rootNode
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

	// Extract the call_expression from await imports
	awaitImports.forEach(declarator => {
		const awaitExpr = declarator.field('value');
		if (awaitExpr) {
			// Find the call_expression inside the await_expression
			const callExpr = awaitExpr.find({
				rule: {
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
			});
			if (callExpr) {
				results.push(callExpr);
			}
		}
	});

	return results;
};


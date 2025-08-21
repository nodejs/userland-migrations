import type { SgRoot, SgNode } from '@codemod.com/jssg-types/main';

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

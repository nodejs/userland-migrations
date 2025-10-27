import type { SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from "@codemod.com/jssg-types/langs/javascript";

/**
 *  We just catch `variable_declarator` nodes that use `require` to import a module
 *  Because a simple `require('nodeAPI')` don't do anything, so in codemod context we don't need to
 *  catch those.
 *  We also catch `require` calls that are not assigned to a variable, like `const fs = require('fs');`
 */
export const getNodeRequireCalls = (rootNode: SgRoot<Js>, nodeModuleName: string): SgNode<Js>[] =>
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
						any: [
							{
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
							},
							{
								kind: "member_expression",
								all: [
									{
										has: {
											field: "object",
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
						]
					}
				}
			]
		}
	});

/**
 * Get the identifier from a namespace require (e.g., const util = require('util'))
 */
export const getRequireNamespaceIdentifier = (requireNode: SgNode<Js>): SgNode<Js> | null => {
	// First check if the name field is an identifier (not an object_pattern)
	const nameField = requireNode.field('name');
	if (nameField && nameField.kind() === 'identifier') {
		return nameField;
	}
	return null;
};

import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import { getScope } from '@nodejs/codemod-utils/ast-grep/get-scope';
import type { Edit, Range, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';

type BindingToReplace = {
	node: SgNode<Js>;
	binding: string;
	variables: { bind: SgNode<Js>; scope: SgNode<Js> }[];
};

type DirArray = {
	node: SgNode<Js, 'variable_declarator'> | SgNode<Js, 'identifier'>;
	scope: SgNode<Js>;
};

type DirValue = {
	node:
		| SgNode<Js, 'array_pattern'>
		| SgNode<Js, 'object_pattern'>
		| SgNode<Js, 'identifier'>
		| SgNode<Js, 'undefined'>
		| SgNode<Js, 'member_expression'>
		| SgNode<Js, 'parenthesized_expression'>
		| SgNode<Js, 'subscript_expression'>;
	scope: SgNode<Js>;
};

type DirDestructuredValue = {
	node: SgNode<Js, 'object_pattern'>;
	scope: SgNode<Js>;
};

const handledFn = ['$.readdir', '$.readdirSync', '$.opendir'];

const handledModules = ['fs', 'fs/promises'];

/*
 * Transforms `dirent.path` usage to `dirent.parentPath`.
 *
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];
	const bindsToReplace: BindingToReplace[] = [];
	const dirArrays: DirArray[] = [];
	const dirValues: DirValue[] = [];
	const dirDestructuredValues: DirDestructuredValue[] = [];

	const importRequireStatement: SgNode<Js>[] = [];
	for (const mod of handledModules) {
		importRequireStatement.push(...getModuleDependencies(root, mod));
	}

	if (!importRequireStatement.length) return null;

	for (const node of importRequireStatement) {
		for (const fn of handledFn) {
			const bind = resolveBindingPath(node, fn);

			if (!bind) continue;

			bindsToReplace.push({
				node,
				binding: bind,
				variables: [],
			});
		}
	}

	for (const bind of bindsToReplace) {
		const matches = rootNode.findAll<'variable_declarator'>({
			rule: {
				any: [
					{
						// created variables without await
						kind: 'variable_declarator',
						has: {
							field: 'value',
							kind: 'call_expression',
							has: {
								field: 'function',
								kind: bind.binding.includes('.')
									? 'member_expression'
									: 'identifier',
								pattern: `${bind.binding}`,
							},
						},
					},
					// created variables with await
					{
						kind: 'variable_declarator',
						has: {
							field: 'value',
							kind: 'await_expression',
							has: {
								kind: 'call_expression',
								has: {
									field: 'function',
									kind: bind.binding.includes('.')
										? 'member_expression'
										: 'identifier',
									pattern: `${bind.binding}`,
								},
							},
						},
					},
				],
			},
		});

		for (const match of matches) {
			dirArrays.push({ node: match, scope: getScope(match) });
		}

		const functionCalls = rootNode.findAll<'call_expression'>({
			rule: {
				kind: 'call_expression',
				has: {
					field: 'function',
					kind: bind.binding.includes('.') ? 'member_expression' : 'identifier',
					pattern: `${bind.binding}`,
				},
			},
		});

		for (const functionCall of functionCalls) {
			const params = functionCall
				.field('arguments')
				.children()
				.filter((arg) =>
					[
						'string',
						'object',
						'arrow_function',
						'function_expression',
						'identifier',
					].includes(arg.kind()),
				);

			//if it had 3 params it means the third will be an callbackFn as fs.readdir, fs.opendir docs
			if (params.length === 3) {
				const arrowFn = params[2];
				const args = arrowFn.field('parameters');

				const fnParams = args.findAll<'identifier'>({
					rule: {
						kind: 'identifier',
					},
				});

				if (fnParams.length === 2) {
					dirArrays.push({ node: fnParams[1], scope: arrowFn.field('body') });
				}
			}
		}
	}

	for (const dirArray of dirArrays) {
		const pattern =
			dirArray.node.kind() === 'variable_declarator'
				? (dirArray.node as SgNode<Js, 'variable_declarator'>)
						.field('name')
						.text()
				: dirArray.node.text();

		const forOfScenarios = dirArray.scope.findAll<'for_in_statement'>({
			rule: {
				kind: 'for_in_statement',
				has: {
					field: 'right',
					kind: 'identifier',
					pattern,
				},
			},
		});

		for (const forOf of forOfScenarios) {
			const leftBind = forOf.field('left');
			const forOfBody = forOf.field('body');

			dirValues.push({
				node: leftBind,
				scope: forOfBody,
			});
		}

		const forScenarios = dirArray.scope.findAll<'for_statement'>({
			rule: {
				kind: 'for_statement',
			},
		});

		for (const forScenario of forScenarios) {
			const matches = forScenario.field('body').findAll({
				rule: {
					kind: 'identifier',
					pattern,
				},
			});

			for (const match of matches) {
				const parent = match.parent();

				if (parent.kind() === 'subscript_expression') {
					if (parent.parent().kind() === 'member_expression') {
						dirValues.push({
							node: parent as SgNode<Js, 'subscript_expression'>,
							scope: forScenario,
						});
					}
					if (parent.parent().kind() === 'variable_declarator') {
						const dirVar = (
							parent.parent() as SgNode<Js, 'variable_declarator'>
						).field('name');

						dirValues.push({
							node: dirVar,
							scope: forScenario,
						});
					}
				}
			}
		}

		const arrMethods = dirArray.scope.findAll({
			rule: {
				kind: 'call_expression',
				has: {
					field: 'function',
					kind: 'member_expression',
					has: {
						field: 'object',
						kind: 'identifier',
						pattern,
					},
				},
			},
		});

		for (const arrMethod of arrMethods) {
			const stmt = getScope(arrMethod, 'expression_statement');

			const arrowFns = stmt.findAll({
				rule: {
					kind: 'arrow_function',
				},
			});

			for (const arrowFn of arrowFns) {
				const parameters =
					arrowFn.field('parameters') || arrowFn.field('parameter');
				const fnBody = arrowFn.field('body');

				const param = parameters?.find<'identifier'>({
					rule: {
						kind: 'identifier',
					},
				});

				if (param) {
					dirValues.push({
						node: param,
						scope: fnBody,
					});
				}

				const paramDestructured = parameters?.find<'object_pattern'>({
					rule: {
						kind: 'object_pattern',
					},
				});

				if (paramDestructured) {
					dirDestructuredValues.push({
						node: paramDestructured,
						scope: fnBody,
					});
				}
			}
		}
	}

	for (const dirValue of dirValues) {
		const pathUses = dirValue.scope.findAll<'member_expression'>({
			rule: {
				kind: 'member_expression',
				pattern: `${dirValue.node.text()}.path`,
			},
		});

		for (const uses of pathUses) {
			edits.push(uses.field('property').replace('parentPath'));
		}
	}

	for (const dirDestructuredValue of dirDestructuredValues) {
		const pathBind =
			dirDestructuredValue.node.find<'shorthand_property_identifier_pattern'>({
				rule: {
					kind: 'shorthand_property_identifier_pattern',
					regex: 'path',
				},
			});

		if (pathBind) {
			edits.push(pathBind.replace('parentPath'));

			const pathUses = dirDestructuredValue.scope.findAll<'member_expression'>({
				rule: {
					kind: 'identifier',
					pattern: 'path',
				},
			});

			for (const pahtUse of pathUses) {
				edits.push(pahtUse.replace('parentPath'));
			}
		}
	}

	if (!edits.length) return;

	const sourceCode = rootNode.commitEdits(edits);

	return removeLines(sourceCode, linesToRemove);
}

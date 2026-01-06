import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import type { Edit, Range, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';

const ZLIB_FACTORIES = [
	'createGzip',
	'createGunzip',
	'createDeflate',
	'createInflate',
	'createBrotliCompress',
	'createBrotliDecompress',
	'createUnzip',
];

const FUNC_KINDS = [
	'function_declaration',
	'function_expression',
	'arrow_function',
] as const;

export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	// 1 Find all static and dynamic zlib imports/requires
	const importNodes = getModuleDependencies(root, 'node:zlib');

	// If no import is found that means we can skip transformation on this file
	if (!importNodes.length) return null;

	const factoryBindings = new Set<string>();
	const streamVariables: string[] = [];

	// 1.a Resolve all local bindings from "node:zlib"
	for (const node of importNodes) {
		for (const factory of ZLIB_FACTORIES) {
			const binding = resolveBindingPath(node, `$.${factory}`);
			if (binding) factoryBindings.add(binding);
		}
	}

	// If no import is found that means we can skip transformation on this file
	if (!importNodes.length) return null;

	// 2 Track variables assigned from factories (const, let, var)
	for (const binding of factoryBindings) {
		const matches = rootNode.findAll({
			rule: {
				kind: 'variable_declarator',
				has: {
					field: 'value',
					kind: 'call_expression',
					pattern: `${binding}($$$ARGS)`,
				},
			},
		});

		for (const match of matches) {
			const varMatch = match.field('name');

			if (varMatch) {
				const varName = varMatch.text();
				if (!streamVariables.includes(varName)) streamVariables.push(varName);
			}
		}
	}

	// 3 Replace .bytesRead → .bytesWritten for tracked variables
	for (const variable of streamVariables) {
		const matches = rootNode.findAll({
			rule: { pattern: `${variable}.bytesRead` },
		});

		for (const match of matches) {
			edits.push(
				match.replace(match.text().replace('.bytesRead', '.bytesWritten')),
			);
		}
	}

	// Step 4: Replace .bytesRead → .bytesWritten for function parameters
	for (const kind of FUNC_KINDS) {
		const funcs = rootNode.findAll({ rule: { kind } });

		for (const func of funcs) {
			const paramNames = func
				.field('parameters')
				?.findAll({ rule: { kind: 'identifier' } });

			for (const paramName of paramNames) {
				// replace member_expressions that use ${paramName}.bytesRead inside the function context
				const matches = func.findAll({
					rule: {
						kind: 'member_expression',
						pattern: `${paramName.text()}.bytesRead`,
					},
				});
				for (const match of matches) {
					edits.push(
						match.replace(match.text().replace('.bytesRead', '.bytesWritten')),
					);
				}
			}
		}
	}

	if (!edits.length) return null;

	return removeLines(rootNode.commitEdits(edits), linesToRemove);
}

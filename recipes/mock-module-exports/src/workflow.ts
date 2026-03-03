import type { SgRoot, Edit, SgNode } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import {
	detectIndentUnit,
	getLineIndent,
} from '@nodejs/codemod-utils/ast-grep/indent';
import { EOL } from 'node:os';

export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	const deps = getModuleDependencies(root, 'test');
	let moduleFnCalls: SgNode<JS, 'call_expression'>[] = [];

	for (const dep of deps) {
		const moduleFn = resolveBindingPath(dep, '$.mock.module');

		const fnCallNodes = rootNode.findAll<'call_expression'>({
			rule: {
				kind: 'call_expression',
				has: {
					any: [
						{
							kind: 'member_expression',
							pattern: moduleFn,
						},
					],
				},
			},
		});

		moduleFnCalls = moduleFnCalls.concat(fnCallNodes);
	}

	for (const moduleFnCall of moduleFnCalls) {
		const argumentsNode = moduleFnCall.field<'arguments'>('arguments');
		const args = argumentsNode.children().filter((node) => node.isNamed());

		if (args.length < 2) continue;
		const optionsArg = args[1];
		const indentUnit = detectIndentUnit(rootNode.text());
		const pairs = [];

		if (optionsArg.is('object')) {
			const defaultExport = optionsArg.find<'pair'>({
				rule: {
					kind: 'pair',
					has: {
						field: 'key',
						kind: 'property_identifier',
						regex: 'defaultExport',
					},
				},
			});

			if (defaultExport) {
				pairs.push(`default: ${defaultExport?.field('value').text()}`);
			}

			const namedExport = optionsArg.find<'pair'>({
				rule: {
					kind: 'pair',
					has: {
						field: 'key',
						kind: 'property_identifier',
						regex: 'namedExport',
					},
				},
			});

			if (namedExport) {
				for (const namedPair of namedExport.field('value').children()) {
					if (!namedPair.is('pair')) continue;
					pairs.push(namedPair.text());
				}
			}

			const indentLevel = getLineIndent(
				rootNode.text(),
				optionsArg.range().start.index,
			);

			const exportsLevel = `${indentLevel}${indentUnit}`;
			const innerExports = `${exportsLevel}${indentUnit}`;

			const newValue =
				`{${EOL}`
				+ `${exportsLevel}exports: {${EOL}`
				+ `${innerExports}${pairs.join(`,${EOL}${innerExports}`)}` + `,${EOL}`
				+ `${exportsLevel}},${EOL}`
				+ `${indentLevel}}`;

			edits.push(optionsArg.replace(newValue));
		}
	}

	let sourceCode = rootNode.commitEdits(edits);

	return sourceCode;
}

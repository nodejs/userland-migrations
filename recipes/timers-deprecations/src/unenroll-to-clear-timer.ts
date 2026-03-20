import { EOL } from 'node:os';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { getLineIndent } from '@nodejs/codemod-utils/ast-grep/indent';
import type { Edit, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';

const TARGET_METHOD = 'unenroll';

export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const sourceCode = rootNode.text();
	const edits: Edit[] = [];
	const handledStatements = new Set<number>();

	const importNodes = getModuleDependencies(root, 'timers');

	for (const importNode of importNodes) {
		if (importNode.is('expression_statement')) continue;
		const bindingPath = resolveBindingPath(importNode, `$.${TARGET_METHOD}`);
		if (!bindingPath) continue;

		const matches = rootNode.findAll({
			rule: {
				any: [
					{ pattern: `${bindingPath}($RESOURCE)` },
					{ pattern: `${bindingPath}($RESOURCE, $$$REST)` },
				],
			},
		});

		for (const match of matches) {
			const resourceNode = match.getMatch('RESOURCE');
			if (!resourceNode) continue;

			const isSafeResourceTarget =
				resourceNode.is('identifier') || resourceNode.is('member_expression');
			if (!isSafeResourceTarget) continue;

			const statement = match.find({
				rule: {
					inside: {
						kind: 'expression_statement',
						stopBy: 'end',
					},
				},
			});
			if (!statement) continue;

			if (handledStatements.has(statement.id())) continue;

			const indent = getLineIndent(sourceCode, statement.range().start.index);
			const resourceText = resourceNode.text();

			const replacement =
				`clearTimeout(${resourceText}.timeout);${EOL}` +
				`${indent}delete ${resourceText}.timeout;`;

			handledStatements.add(statement.id());
			edits.push(statement.replace(replacement));
		}
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

import {
	getNodeImportStatements,
	getNodeImportCalls,
} from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import {
	detectIndentUnit,
	findParentStatement,
	getLineIndent,
	isSafeResourceTarget,
} from './shared.ts';
import type { Edit, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

const TARGET_METHOD = 'enroll';

export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const sourceCode = rootNode.text();
	const indentUnit = detectIndentUnit(sourceCode);
	const edits: Edit[] = [];
	const handledStatements = new Set<number>();

	const importNodes = [
		...getNodeRequireCalls(root, 'timers'),
		...getNodeImportStatements(root, 'timers'),
		...getNodeImportCalls(root, 'timers'),
	];

	for (const importNode of importNodes) {
		if (importNode.kind() === 'expression_statement') continue;
		const bindingPath = resolveBindingPath(importNode, `$.${TARGET_METHOD}`);
		if (!bindingPath) continue;

		const matches = rootNode.findAll({
			rule: { pattern: `${bindingPath}($RESOURCE, $TIMEOUT)` },
		});

		for (const match of matches) {
			const resourceNode = match.getMatch('RESOURCE');
			const timeoutNode = match.getMatch('TIMEOUT');
			if (!resourceNode || !timeoutNode) continue;

			if (!isSafeResourceTarget(resourceNode)) continue;

			const statement = findParentStatement(match);
			if (!statement) continue;

			if (handledStatements.has(statement.id())) continue;
			handledStatements.add(statement.id());

			const indent = getLineIndent(sourceCode, statement.range().start.index);
			const resourceText = resourceNode.text();
			const timeoutText = timeoutNode.text();
			const childIndent = indent + indentUnit;
			const innerIndent = childIndent + indentUnit;

			const replacement =
				`${resourceText}._idleTimeout = ${timeoutText};\n` +
				`${indent}${resourceText}.timeout = setTimeout(() => {\n` +
				`${childIndent}if (typeof ${resourceText}._onTimeout === "function") {\n` +
				`${innerIndent}${resourceText}._onTimeout();\n` +
				`${childIndent}}\n` +
				`${indent}}, ${timeoutText});`;

			edits.push(statement.replace(replacement));
		}
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { removeBinding } from '@nodejs/codemod-utils/ast-grep/remove-binding';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import type { Edit, Range, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';

const COMMENT_ALREADY_PARSED =
	'/* DEP0076: cert.subject/cert.issuer are already parsed */';
const COMMENT_MANUAL_PARSE =
	'/* DEP0076: use node:crypto X509Certificate for robust parsing */';

function stripOuterParens(text: string): string {
	let value = text.trim();
	while (value.startsWith('(') && value.endsWith(')')) {
		value = value.slice(1, -1).trim();
	}
	return value;
}

function isAlreadyParsedCertField(argText: string): boolean {
	const normalized = stripOuterParens(argText);
	return /\.(subject|issuer)$/.test(normalized);
}

function buildReplacement(argText: string): string {
	if (isAlreadyParsedCertField(argText)) {
		return `${COMMENT_ALREADY_PARSED} ${argText}`;
	}

	return `${COMMENT_MANUAL_PARSE} Object.fromEntries(String(${argText}).split('/').filter(Boolean).map((pair) => pair.split('=')))`;
}

function trimSingleLeadingBlankLine(sourceCode: string): string {
	if (sourceCode.startsWith('\n')) {
		return sourceCode.slice(1);
	}
	return sourceCode;
}

function isInsideNode(node: SgNode<JS>, container: SgNode<JS>): boolean {
	for (const ancestor of node.ancestors()) {
		if (ancestor.id() === container.id()) return true;
	}
	return false;
}

function isInsideAnyCall(node: SgNode<JS>, calls: SgNode<JS>[]): boolean {
	for (const callNode of calls) {
		if (node.id() === callNode.id()) return true;
		if (isInsideNode(node, callNode)) return true;
	}
	return false;
}

function hasNonCallUsage(
	rootNode: SgNode<JS>,
	statement: SgNode<JS>,
	binding: string,
): boolean {
	const occurrences = rootNode.findAll({
		rule: {
			pattern: binding,
		},
	});

	const callOccurrences = rootNode.findAll({
		rule: {
			pattern: `${binding}($$$ARGS)`,
		},
	});

	for (const occurrence of occurrences) {
		if (isInsideNode(occurrence, statement)) continue;
		if (isInsideAnyCall(occurrence, callOccurrences)) continue;
		return true;
	}

	return false;
}

export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	const tlsImports = getModuleDependencies(root, 'tls');
	if (!tlsImports.length) return null;

	const parseBindings = new Set<string>();
	for (const stmt of tlsImports) {
		const binding = resolveBindingPath(stmt, '$.parseCertString');
		if (!binding) continue;
		parseBindings.add(binding);
	}

	if (!parseBindings.size) return null;

	for (const binding of parseBindings) {
		const callNodes = rootNode.findAll({
			rule: {
				pattern: `${binding}($ARG)`,
			},
		});

		for (const callNode of callNodes) {
			const arg = callNode.getMatch('ARG');
			if (!arg) continue;
			edits.push(callNode.replace(buildReplacement(arg.text())));
		}
	}

	for (const stmt of tlsImports) {
		const binding = resolveBindingPath(stmt, '$.parseCertString');
		if (!binding || binding.includes('.')) continue;
		if (hasNonCallUsage(rootNode, stmt, binding)) continue;

		const result = removeBinding(stmt, binding);
		if (result?.edit) edits.push(result.edit);
		if (result?.lineToRemove) linesToRemove.push(result.lineToRemove);
	}

	if (!edits.length && !linesToRemove.length) return null;

	const sourceCode = rootNode.commitEdits(edits);
	return trimSingleLeadingBlankLine(removeLines(sourceCode, linesToRemove));
}

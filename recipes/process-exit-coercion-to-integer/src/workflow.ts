import { getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import type { Edit, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';

type ExitMode = 'exit' | 'exitCode';

type InferredIdentifierKind =
	| 'boolean_true'
	| 'boolean_false'
	| 'integer_number'
	| 'float_number'
	| 'integer_string'
	| 'non_integer_string'
	| 'null'
	| 'undefined'
	| 'object'
	| 'unknown';

type InferredIdentifier = {
	kind: InferredIdentifierKind;
	initializerNode: SgNode<JS>;
};

function isIntegerNumber(text: string): boolean {
	const numeric = Number(text);
	return Number.isFinite(numeric) && Number.isInteger(numeric);
}

function isIntegerStringValue(value: string): boolean {
	return /^-?\d+$/.test(value);
}

function getStringLiteralValue(node: SgNode<JS>): string | null {
	if (node.kind() !== 'string') return null;
	const text = node.text();
	if (text.length < 2) return null;
	const quote = text[0];
	if ((quote !== '"' && quote !== "'") || text[text.length - 1] !== quote) {
		return null;
	}
	return text.slice(1, -1);
}

function inferIdentifierKind(valueNode: SgNode<JS>): InferredIdentifierKind {
	const kind = valueNode.kind();
	if (kind === 'true') return 'boolean_true';
	if (kind === 'false') return 'boolean_false';
	if (kind === 'null') return 'null';

	if (kind === 'identifier' && valueNode.text() === 'undefined') {
		return 'undefined';
	}

	if (kind === 'number') {
		return isIntegerNumber(valueNode.text())
			? 'integer_number'
			: 'float_number';
	}

	if (kind === 'string') {
		const value = getStringLiteralValue(valueNode);
		if (value === null) return 'unknown';
		return isIntegerStringValue(value)
			? 'integer_string'
			: 'non_integer_string';
	}

	if (kind === 'object') return 'object';

	return 'unknown';
}

function floorWrap(expressionText: string): string {
	return `Math.floor(${expressionText})`;
}

function coerceBoolean(expressionText: string, mode: ExitMode): string {
	if (mode === 'exit') return `${expressionText} ? 1 : 0`;
	return `${expressionText} ? 0 : 1`;
}

function getObjectCodeValue(objectNode: SgNode<JS>): SgNode<JS> | null {
	const pairs = objectNode.findAll({
		rule: {
			kind: 'pair',
		},
	});

	for (const pair of pairs) {
		const key = pair.field('key');
		const value = pair.field('value');
		if (!key || !value) continue;
		if (key.text() === 'code') return value;
	}

	return null;
}

function coerceFromObjectLiteral(
	objectNode: SgNode<JS>,
	mode: ExitMode,
): string {
	if (mode !== 'exitCode') return '1';

	const codeValue = getObjectCodeValue(objectNode);
	if (!codeValue) return '1';

	const kind = inferIdentifierKind(codeValue);
	if (kind === 'integer_number' || kind === 'integer_string') {
		return codeValue.text();
	}
	if (kind === 'null' || kind === 'undefined') {
		return codeValue.text();
	}
	if (kind === 'boolean_true' || kind === 'boolean_false') {
		return coerceBoolean(codeValue.text(), mode);
	}
	if (kind === 'float_number') {
		return floorWrap(codeValue.text());
	}

	return '1';
}

function shouldFloorExpression(node: SgNode<JS>): boolean {
	const kind = node.kind();
	return (
		kind === 'binary_expression' ||
		kind === 'unary_expression' ||
		kind === 'update_expression'
	);
}

function coerceValueNode(
	node: SgNode<JS>,
	mode: ExitMode,
	inferredIdentifiers: Map<string, InferredIdentifier>,
): string | null {
	const kind = inferIdentifierKind(node);

	if (
		kind === 'undefined' ||
		kind === 'null' ||
		kind === 'integer_number' ||
		kind === 'integer_string'
	) {
		return null;
	}

	if (kind === 'boolean_true' || kind === 'boolean_false') {
		return mode === 'exit'
			? kind === 'boolean_true'
				? '1'
				: '0'
			: kind === 'boolean_true'
				? '0'
				: '1';
	}

	if (kind === 'non_integer_string') return '1';

	if (kind === 'float_number') return floorWrap(node.text());

	if (kind === 'object') return coerceFromObjectLiteral(node, mode);

	if (node.kind() === 'identifier') {
		const inferred = inferredIdentifiers.get(node.text());
		if (!inferred) return null;

		if (inferred.kind === 'boolean_true' || inferred.kind === 'boolean_false') {
			return coerceBoolean(node.text(), mode);
		}
		if (inferred.kind === 'float_number') return floorWrap(node.text());
		if (inferred.kind === 'non_integer_string') return '1';
		if (inferred.kind === 'object') {
			return coerceFromObjectLiteral(inferred.initializerNode, mode);
		}
		return null;
	}

	if (shouldFloorExpression(node)) {
		return floorWrap(node.text());
	}

	return null;
}

function collectInferredIdentifiers(
	rootNode: SgNode<JS>,
): Map<string, InferredIdentifier> {
	const inferred = new Map<string, InferredIdentifier>();
	const declarators = rootNode.findAll({
		rule: {
			kind: 'variable_declarator',
		},
	});

	for (const declarator of declarators) {
		const name = declarator.field('name');
		const value = declarator.field('value');
		if (!name || !value || name.kind() !== 'identifier') continue;

		inferred.set(name.text(), {
			kind: inferIdentifierKind(value),
			initializerNode: value,
		});
	}

	return inferred;
}

export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	const inferredIdentifiers = collectInferredIdentifiers(rootNode);

	const exitBindings = new Set<string>(['process.exit']);
	const exitCodeBindings = new Set<string>(['process.exitCode']);

	const processDependencies = [
		...getNodeImportStatements(root, 'process'),
		...getNodeRequireCalls(root, 'process'),
	];
	for (const dependency of processDependencies) {
		const exitBinding = resolveBindingPath(dependency, '$.exit');
		if (exitBinding) exitBindings.add(exitBinding);

		const exitCodeBinding = resolveBindingPath(dependency, '$.exitCode');
		if (exitCodeBinding) exitCodeBindings.add(exitCodeBinding);
	}

	for (const binding of exitBindings) {
		const callNodes = rootNode.findAll({
			rule: {
				pattern: `${binding}($ARG)`,
			},
		});

		for (const callNode of callNodes) {
			const argNode = callNode.getMatch('ARG');
			if (!argNode) continue;

			const replacement = coerceValueNode(argNode, 'exit', inferredIdentifiers);

			if (!replacement || replacement === argNode.text()) continue;
			edits.push(argNode.replace(replacement));
		}
	}

	for (const binding of exitCodeBindings) {
		const assignmentNodes = rootNode.findAll({
			rule: {
				pattern: `${binding} = $VALUE`,
			},
		});

		for (const assignmentNode of assignmentNodes) {
			const valueNode = assignmentNode.getMatch('VALUE');
			if (!valueNode) continue;

			const replacement = coerceValueNode(
				valueNode,
				'exitCode',
				inferredIdentifiers,
			);

			if (!replacement || replacement === valueNode.text()) continue;
			edits.push(valueNode.replace(replacement));
		}
	}

	if (!edits.length) return null;
	return rootNode.commitEdits(edits);
}

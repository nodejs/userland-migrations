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
	initializerText: string;
};

const TRUE_LITERAL = 'true';
const FALSE_LITERAL = 'false';

function isIntegerNumberLiteral(text: string): boolean {
	return /^-?\d+$/.test(text);
}

function isFloatNumberLiteral(text: string): boolean {
	return /^-?(?:\d+\.\d+|\d+\.\d*|\d*\.\d+)(?:e[+-]?\d+)?$/i.test(text);
}

function isQuotedStringLiteral(text: string): boolean {
	return /^(['"])(?:[^\\]|\\.)*\1$/.test(text);
}

function isIntegerStringLiteral(text: string): boolean {
	const match = text.match(/^(['"])((?:[^\\]|\\.)*)\1$/);
	if (!match) return false;
	return /^-?\d+$/.test(match[2]);
}

function stripOuterParens(text: string): string {
	let trimmed = text.trim();
	while (trimmed.startsWith('(') && trimmed.endsWith(')')) {
		trimmed = trimmed.slice(1, -1).trim();
	}
	return trimmed;
}

function isBooleanExpression(text: string): boolean {
	return /(===|!==|==|!=|>=|<=|>|<|&&|\|\||!)/.test(text);
}

function isNumericExpressionKind(kind: string): boolean {
	return (
		kind === 'binary_expression' ||
		kind === 'unary_expression' ||
		kind === 'update_expression'
	);
}

function extractCodePropertyFromObjectLiteral(text: string): string | null {
	const match = text.match(/\bcode\s*:\s*([^,}\n]+)/);
	if (!match) return null;
	return match[1].trim();
}

function inferIdentifierKind(valueNode: SgNode<JS>): InferredIdentifierKind {
	const kind = valueNode.kind();
	const valueText = stripOuterParens(valueNode.text());

	if (valueText === TRUE_LITERAL) return 'boolean_true';
	if (valueText === FALSE_LITERAL) return 'boolean_false';
	if (valueText === 'undefined') return 'undefined';
	if (valueText === 'null') return 'null';
	if (isIntegerNumberLiteral(valueText)) return 'integer_number';
	if (isFloatNumberLiteral(valueText)) return 'float_number';
	if (isIntegerStringLiteral(valueText)) return 'integer_string';
	if (isQuotedStringLiteral(valueText)) return 'non_integer_string';
	if (kind === 'object') return 'object';

	return 'unknown';
}

function floorWrap(expressionText: string): string {
	return `Math.floor(${expressionText})`;
}

function coerceBoolean(identifierOrLiteral: string, mode: ExitMode): string {
	if (mode === 'exit') return `${identifierOrLiteral} ? 1 : 0`;
	return `${identifierOrLiteral} ? 0 : 1`;
}

function coerceFromObjectLiteral(valueText: string, mode: ExitMode): string {
	if (mode !== 'exitCode') return '1';

	const extracted = extractCodePropertyFromObjectLiteral(valueText);
	if (!extracted) return '1';

	const normalized = stripOuterParens(extracted);

	if (
		normalized === 'undefined' ||
		normalized === 'null' ||
		isIntegerNumberLiteral(normalized) ||
		isIntegerStringLiteral(normalized)
	) {
		return extracted;
	}

	if (normalized === TRUE_LITERAL) return '0';
	if (normalized === FALSE_LITERAL) return '1';
	if (isFloatNumberLiteral(normalized)) return floorWrap(extracted);
	if (isBooleanExpression(normalized)) return coerceBoolean(extracted, mode);

	return '1';
}

function coerceValueText(
	rawValueText: string,
	valueKind: string,
	mode: ExitMode,
	inferredIdentifiers: Map<string, InferredIdentifier>,
): string | null {
	const normalized = stripOuterParens(rawValueText);

	if (normalized === 'undefined' || normalized === 'null') return null;
	if (isIntegerNumberLiteral(normalized)) return null;
	if (isIntegerStringLiteral(normalized)) return null;

	if (normalized === TRUE_LITERAL || normalized === FALSE_LITERAL) {
		if (mode === 'exit') return normalized === TRUE_LITERAL ? '1' : '0';
		return normalized === TRUE_LITERAL ? '0' : '1';
	}

	if (isQuotedStringLiteral(normalized)) return '1';

	if (valueKind === 'object' || normalized.startsWith('{')) {
		return coerceFromObjectLiteral(rawValueText, mode);
	}

	if (valueKind === 'identifier') {
		const inferred = inferredIdentifiers.get(normalized);
		if (!inferred) return null;

		switch (inferred.kind) {
			case 'boolean_true':
			case 'boolean_false':
				return coerceBoolean(normalized, mode);
			case 'float_number':
				return floorWrap(normalized);
			case 'non_integer_string':
				return '1';
			case 'object':
				return coerceFromObjectLiteral(inferred.initializerText, mode);
			default:
				return null;
		}
	}

	if (isFloatNumberLiteral(normalized)) return floorWrap(rawValueText);

	if (isNumericExpressionKind(valueKind) && !isBooleanExpression(normalized)) {
		return floorWrap(rawValueText);
	}

	if (isBooleanExpression(normalized)) {
		return coerceBoolean(rawValueText, mode);
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
			initializerText: value.text(),
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

			const replacement = coerceValueText(
				argNode.text(),
				argNode.kind(),
				'exit',
				inferredIdentifiers,
			);

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

			const replacement = coerceValueText(
				valueNode.text(),
				valueNode.kind(),
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

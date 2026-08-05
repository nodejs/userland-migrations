import { useMetricAtom } from 'codemod:metrics';
import type { Codemod, SgRoot, SgNode, Edit } from 'codemod:ast-grep';
import type JS from 'codemod:ast-grep/langs/javascript';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';

const RSA_PSS_REGEX = /^['"]rsa-pss['"]$/;
const IDENTIFIER_REGEX = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
const HASH_MAPPINGS = {
	hash: 'hashAlgorithm',
	mgf1Hash: 'mgf1HashAlgorithm',
} as const;

const propertyMetric = useMetricAtom('crypto-rsa-pss-properties');
const filesMetric = useMetricAtom('crypto-rsa-pss-files');

function transformRsaPssCalls(
	rootNode: SgNode<JS>,
	allCalls: SgNode<JS>[],
): Edit[] {
	const edits: Edit[] = [];

	for (const call of allCalls) {
		const typeMatch = call.getMatch('TYPE');
		const optionsMatch = call.getMatch('OPTIONS');

		if (!typeMatch || !optionsMatch) continue;

		const typeText = getText(typeMatch);
		if (!typeText) continue;

		if (!isRsaPssType(rootNode, typeText)) continue;

		const directObject = optionsMatch.find({
			rule: {
				kind: 'object',
			},
		});

		if (directObject) {
			edits.push(
				...transformHashPropertiesInObject(directObject, 'call-direct-object'),
			);
		} else {
			edits.push(...processOptionsReference(rootNode, optionsMatch));
		}
	}

	return edits;
}

function getCryptoBindings(root: SgRoot<JS>): string[] {
	const bindings = resolveBindings(getModuleDependencies(root, 'crypto'), [
		'$.generateKeyPair',
		'$.generateKeyPairSync',
	]);
	return [...bindings, ...getPromisifiedBindings(root, bindings)];
}

function getPromisifiedBindings(
	root: SgRoot<JS>,
	existingBindings: string[],
): string[] {
	const utilStatements = getModuleDependencies(root, 'util');
	const promisifyBindings = resolveBindings(utilStatements, '$.promisify');

	if (promisifyBindings.length === 0 && utilStatements.length > 0) {
		promisifyBindings.push('util.promisify');
	}

	return uniqueArray(
		existingBindings.flatMap((binding) =>
			promisifyBindings.flatMap((promisifyBinding) =>
				findPromisifiedDeclarations(root.root(), binding, promisifyBinding),
			),
		),
	);
}

function findCryptoCalls(
	rootNode: SgNode<JS>,
	bindings: string[],
): SgNode<JS>[] {
	return bindings.flatMap((bindingName) =>
		rootNode.findAll({
			rule: {
				any: [
					{ pattern: `${bindingName}($TYPE, $OPTIONS, $CALLBACK)` },
					{ pattern: `${bindingName}($TYPE, $OPTIONS)` },
				],
			},
		}),
	);
}

function getText(node: SgNode<JS> | undefined): string | null {
	const text = node?.text()?.trim();
	return text || null;
}

function resolveBindings(
	statements: SgNode<JS>[],
	paths: string | string[],
): string[] {
	const pathArray = Array.isArray(paths) ? paths : [paths];

	return statements.flatMap((stmt) =>
		pathArray
			.map((path) => resolveBindingPath(stmt as unknown as SgNode<JS>, path))
			.filter(Boolean),
	);
}

function isValidHashKey(key: string | undefined): key is 'hash' | 'mgf1Hash' {
	return key === 'hash' || key === 'mgf1Hash';
}

function findPromisifiedDeclarations(
	rootNode: SgNode<JS>,
	binding: string,
	promisifyBinding: string,
): string[] {
	const promisified = rootNode.findAll({
		rule: {
			kind: 'lexical_declaration',
			has: {
				kind: 'variable_declarator',
				has: {
					kind: 'call_expression',
					pattern: `${promisifyBinding}(${binding})`,
				},
			},
		},
	});

	return promisified
		.map((decl) => {
			const variableDeclarator = decl.find({
				rule: { kind: 'variable_declarator' },
			});
			const identifier = variableDeclarator?.child(0);
			return identifier?.kind() === 'identifier' ? getText(identifier) : null;
		})
		.filter(Boolean);
}

function checkVariableDeclarations(
	rootNode: SgNode<JS>,
	declarationType: 'const' | 'let',
	identifier: string,
	expectedValue: RegExp,
): boolean {
	const declarations = rootNode.findAll({
		rule: {
			pattern: `${declarationType} ${identifier} = $VALUE`,
		},
	});

	return declarations.some((decl) => {
		const valueText = getText(decl.getMatch('VALUE'));
		return valueText && expectedValue.test(valueText);
	});
}

function isRsaPssType(rootNode: SgNode<JS>, typeText: string): boolean {
	return (
		RSA_PSS_REGEX.test(typeText) ||
		(IDENTIFIER_REGEX.test(typeText) &&
			(checkVariableDeclarations(rootNode, 'const', typeText, RSA_PSS_REGEX) ||
				checkVariableDeclarations(rootNode, 'let', typeText, RSA_PSS_REGEX)))
	);
}

function transformHashPropertiesInObject(
	objectNode: SgNode<JS>,
	site: string,
): Edit[] {
	return objectNode
		.findAll({ rule: { kind: 'pair' } })
		.map((pair) => {
			const keyNode = pair.find({
				rule: {
					any: [
						{ regex: 'hash', kind: 'property_identifier' },
						{ regex: 'mgf1Hash', kind: 'property_identifier' },
					],
				},
			});

			const key = getText(keyNode);
			if (!isValidHashKey(key)) return null;

			const valueNode = pair.find({
				rule: {
					any: [
						{ kind: 'string' },
						{ kind: 'identifier' },
						{ kind: 'template_string' },
						{ kind: 'member_expression' },
						{ kind: 'call_expression' },
						{ kind: 'binary_expression' },
						{ kind: 'ternary_expression' },
						{ kind: 'spread_element' },
					],
				},
			});
			const value = getText(valueNode);
			if (!value) return null;

			propertyMetric.increment({ site, key });

			return pair.replace(`${HASH_MAPPINGS[key]}: ${value}`);
		})
		.filter(Boolean);
}

function processOptionsReference(
	rootNode: SgNode<JS>,
	optionsMatch: SgNode<JS>,
): Edit[] {
	const optionsText = getText(optionsMatch);
	if (!optionsText) return [];

	if (IDENTIFIER_REGEX.test(optionsText)) {
		return findAndTransformObjects(
			rootNode,
			[`const ${optionsText} = { $$$PROPS }`],
			'options-identifier',
		);
	}

	if (optionsMatch.find({ rule: { kind: 'call_expression' } })) {
		const functionName = optionsText.replace(/\(\).*$/, '');
		return findAndTransformObjects(
			rootNode,
			[
				`function ${functionName}() { return { $$$PROPS } }`,
				`const ${functionName} = () => ({ $$$PROPS })`,
				`const ${functionName} = function() { return { $$$PROPS } }`,
			],
			'options-function',
		);
	}

	return [];
}

function getOptionsMatches(allCalls: SgNode<JS>[]): SgNode<JS>[] {
	return allCalls.map((call) => call.getMatch('OPTIONS')).filter(Boolean);
}

function uniqueArray<T>(items: T[]): T[] {
	return Array.from(new Set(items));
}

function findAndTransformObjects(
	rootNode: SgNode<JS>,
	patterns: string[],
	site: string,
): Edit[] {
	return patterns.flatMap((pattern) =>
		rootNode
			.findAll({ rule: { pattern } })
			.flatMap((decl) => transformHashPropertiesInObject(decl, site)),
	);
}

function transformSpreadObjectDeclarations(
	rootNode: SgNode<JS>,
	allCalls: SgNode<JS>[],
): Edit[] {
	const spreadNames = uniqueArray(
		getOptionsMatches(allCalls).flatMap((optionsMatch) =>
			optionsMatch
				.findAll({ rule: { kind: 'spread_element' } })
				.map((spread) => getText(spread.find({ rule: { kind: 'identifier' } })))
				.filter(Boolean),
		),
	);

	const patterns = spreadNames.map(
		(spreadName) => `const ${spreadName} = { $$$PROPS }`,
	);
	return findAndTransformObjects(rootNode, patterns, 'spread-declaration');
}

function processThisPropertyReferences(
	rootNode: SgNode<JS>,
	allCalls: SgNode<JS>[],
): Edit[] {
	const propertyNames = uniqueArray(
		getOptionsMatches(allCalls)
			.map((optionsMatch) => getText(optionsMatch))
			.filter((text) => text?.startsWith('this.'))
			.map((text) => text!.replace('this.', '')),
	);

	const patterns = propertyNames.map(
		(propName) => `this.${propName} = { $$$PROPS }`,
	);
	return findAndTransformObjects(rootNode, patterns, 'this-property');
}

function transformAssignmentPattern(
	rootNode: SgNode<JS>,
	oldProperty: string,
	newProperty: string,
): Edit[] {
	const assignments = rootNode.findAll({
		rule: {
			pattern: `$OBJECT.${oldProperty} = $VALUE`,
		},
	});

	return assignments
		.map((assignment) => {
			const objectMatch = assignment.getMatch('OBJECT');
			const valueMatch = assignment.getMatch('VALUE');

			if (objectMatch && valueMatch) {
				const objectText = getText(objectMatch);
				const valueText = getText(valueMatch);

				if (objectText && valueText) {
					propertyMetric.increment({
						site: 'direct-assignment',
						key: oldProperty,
					});
					return assignment.replace(
						`${objectText}.${newProperty} = ${valueText}`,
					);
				}
			}
			return null;
		})
		.filter(Boolean);
}

function transformPropertyAssignments(rootNode: SgNode<JS>): Edit[] {
	return [
		...transformAssignmentPattern(rootNode, 'hash', 'hashAlgorithm'),
		...transformAssignmentPattern(rootNode, 'mgf1Hash', 'mgf1HashAlgorithm'),
	];
}

function transformVariableHashStrings(rootNode: SgNode<JS>): Edit[] {
	return findAndTransformVariableDeclarations(rootNode, [
		{ from: "'hash'", to: "'hashAlgorithm'" },
		{ from: "'mgf1Hash'", to: "'mgf1HashAlgorithm'" },
		{ from: "'mgf1' + 'Hash'", to: "'mgf1HashAlgorithm'" },
		{ from: "'mgf1' + 'HashAlgorithm'", to: "'mgf1HashAlgorithm'" },
	]);
}

function findAndTransformVariableDeclarations(
	rootNode: SgNode<JS>,
	transformations: Array<{ from: string; to: string }>,
): Edit[] {
	return transformations.flatMap(({ from, to }) =>
		rootNode
			.findAll({
				rule: {
					any: [
						{ pattern: `const $VAR = ${from}` },
						{ pattern: `let $VAR = ${from}` },
						{ pattern: `var $VAR = ${from}` },
					],
				},
			})
			.map((decl) => {
				propertyMetric.increment({ site: 'variable-string', key: from });
				return decl.replace(decl.text().replace(from, to));
			}),
	);
}

const transform: Codemod<JS> = async (root) => {
	const rootNode = root.root();
	const cryptoBindings = getCryptoBindings(root);
	const allCalls = findCryptoCalls(rootNode, cryptoBindings);

	const allEdits = [
		...transformRsaPssCalls(rootNode, allCalls),
		...transformSpreadObjectDeclarations(rootNode, allCalls),
		...processThisPropertyReferences(rootNode, allCalls),
		...transformPropertyAssignments(rootNode),
		...transformVariableHashStrings(rootNode),
	];

	if (!allEdits.length) {
		filesMetric.increment({ status: 'no-changes' });
		return null;
	}

	filesMetric.increment({ status: 'migrated' });

	return rootNode.commitEdits(allEdits);
}

export default transform;

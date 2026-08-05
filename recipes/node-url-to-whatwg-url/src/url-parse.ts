import { useMetricAtom } from 'codemod:metrics';
import type { Codemod, Edit } from 'codemod:ast-grep';
import type JS from 'codemod:ast-grep/langs/javascript';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';


const VALID_VARIABLE_NAME_REGEX = /^[$A-Z_a-z][$\w]*$/;
const DESTRUCTURING_ASSIGNMENT_REGEX = /^[^{]+{\s*[^}]+\s*}\s*=\s*/;
const HOSTNAME_BRACKETS_REGEX = /^\[|\]$/;

const parseCallsReplacedMetric = useMetricAtom('url_parse_calls_replaced');
const legacyPropertyAccessesMetric = useMetricAtom(
	'legacy_url_property_accesses_transformed',
);
const destructuringAssignmentsMetric = useMetricAtom(
	'url_destructuring_assignments_updated',
);
const filesMetric = useMetricAtom('url_migration_files');

const fieldsToReplace = [
	{
		key: 'auth',
		replaceFn: (
			base: string,
			hadSemi: boolean,
			declKind: 'const' | 'let' | 'var',
		) => {
			const kind = declKind === 'var' ? 'let' : declKind;

			return `${kind} auth = \`\${${base}.username}:\${${base}.password}\`${hadSemi ? ';' : ''}`;
		},
	},
	{
		key: 'path',
		replaceFn: (
			base: string,
			hadSemi: boolean,
			declKind: 'const' | 'let' | 'var',
		) => {
			const kind = declKind === 'var' ? 'let' : declKind;

			return `${kind} path = \`\${${base}.pathname}\${${base}.search}\`${hadSemi ? ';' : ''}`;
		},
	},
	{
		key: 'hostname',
		replaceFn: (
			base: string,
			hadSemi: boolean,
			declKind: 'const' | 'let' | 'var',
		) => {
			const kind = declKind === 'var' ? 'let' : declKind;

			return `${kind} hostname = ${base}.hostname.replace(${HOSTNAME_BRACKETS_REGEX}, '')${hadSemi ? ';' : ''}`;
		},
	},
];

const transform: Codemod<JS> = async (root) => {
	const rootNode = root.root();
	const edits: Edit[] = [];

	const importsAndRequires = getModuleDependencies(root, 'url');

	if (!importsAndRequires.length) {
		filesMetric.increment({ status: 'no-changes' });
		return null;
	}

	// 1) Replace parse calls with new URL() using binding-aware patterns
	const parseCallPatterns = new Set<string>();

	for (const node of importsAndRequires) {
		const binding = resolveBindingPath(node, '$.parse');
		if (binding) parseCallPatterns.add(`${binding}($ARG)`);
	}

	// 1.a) Identify variables assigned from parse(...) so we only rewrite legacy
	// properties (auth, path, hostname) on those specific objects
	const parseResultVars = new Set<string>();
	for (const pattern of parseCallPatterns) {
		const matches = rootNode.findAll({
			rule: {
				any: [
					{ pattern: `const $OBJ = ${pattern}` },
					{ pattern: `let $OBJ = ${pattern}` },
					{ pattern: `var $OBJ = ${pattern}` },
					{ pattern: `$OBJ = ${pattern}` },
				],
			},
		});

		for (const m of matches) {
			const obj = m.getMatch('OBJ');
			if (!obj) continue;
			const name = obj.text();
			if (VALID_VARIABLE_NAME_REGEX.test(name)) parseResultVars.add(name);
		}
	}

	// 1.b) Replace parse calls with new URL()
	for (const pattern of parseCallPatterns) {
		const calls = rootNode.findAll({ rule: { pattern } });

		for (const call of calls) {
			const arg = call.getMatch('ARG');
			if (!arg) continue;

			edits.push(call.replace(`new URL(${arg.text()})`));
			parseCallsReplacedMetric.increment({ kind: 'parse-call-replacement' });
		}
	}

	// 2) Transform legacy properties on URL object
	for (const { key } of fieldsToReplace) {
		// 2.a) Handle property access for identifiers that originate from parse(...)
		for (const varName of parseResultVars) {
			const propertyAccesses = rootNode.findAll({
				rule: { pattern: `${varName}.${key}` },
			});
			for (const node of propertyAccesses) {
				let replacement = '';

				if (key === 'auth') {
					replacement = `\`\${${varName}.username}:\${${varName}.password}\``;
				} else if (key === 'path') {
					replacement = `\`\${${varName}.pathname}\${${varName}.search}\``;
				} else if (key === 'hostname') {
					replacement = `${varName}.hostname.replace(/^\\[|\\]$/, '')`;
				}
				edits.push(node.replace(replacement));
				legacyPropertyAccessesMetric.increment({
					kind: 'property-access',
					property: key,
				});
			}

			// destructuring for identifiers without looping kinds
			const destructures = rootNode.findAll({
				rule: {
					any: [
						{ pattern: `const { ${key} } = ${varName}` },
						{ pattern: `let { ${key} } = ${varName}` },
						{ pattern: `var { ${key} } = ${varName}` },
					],
				},
			});
			for (const node of destructures) {
				const text = node.text();
				const hadSemi = /;\s*$/.test(text);
				const declKind = text.trimStart().startsWith('var ')
					? 'var'
					: text.trimStart().startsWith('const ')
						? 'const'
						: 'let';
				const replacement = fieldsToReplace
					.find((f) => f.key === key)!
					.replaceFn(varName, hadSemi, declKind);
				edits.push(node.replace(replacement));
				destructuringAssignmentsMetric.increment({
					kind: 'destructuring-assignment',
					property: key,
				});
			}
		}

		// 2.b) Handle direct call expressions like parse(...).auth and
		// destructuring from parse(...)
		for (const pattern of parseCallPatterns) {
			const directAccesses = rootNode.findAll({
				rule: { pattern: `${pattern}.${key}` },
			});
			for (const node of directAccesses) {
				const baseExpr = node.text().replace(new RegExp(`\\.${key}$`), '');
				let replacement = '';

				if (key === 'auth') {
					replacement = `\`\${${baseExpr}.username}:\${${baseExpr}.password}\``;
				} else if (key === 'path') {
					replacement = `\`\${${baseExpr}.pathname}\${${baseExpr}.search}\``;
				} else if (key === 'hostname') {
					replacement = `${baseExpr}.hostname.replace(/^\\[|\\]$/, '')`;
				}

				edits.push(node.replace(replacement));
				legacyPropertyAccessesMetric.increment({
					kind: 'direct-property-access',
					property: key,
				});
			}

			// direct destructuring from parse(...)
			const directDestructures = rootNode.findAll({
				rule: {
					any: [
						{ pattern: `const { ${key} } = ${pattern}` },
						{ pattern: `let { ${key} } = ${pattern}` },
						{ pattern: `var { ${key} } = ${pattern}` },
					],
				},
			});

			for (const node of directDestructures) {
				const text = node.text();
				const hadSemi = /;\s*$/.test(text);
				const rhsText = text.replace(DESTRUCTURING_ASSIGNMENT_REGEX, '');
				const declKind: 'const' | 'let' | 'var' = text
					.trimStart()
					.startsWith('var ')
					? 'var'
					: text.trimStart().startsWith('const ')
						? 'const'
						: 'let';
				const replacement = fieldsToReplace
					.find((f) => f.key === key)!
					.replaceFn(rhsText, hadSemi, declKind);
				edits.push(node.replace(replacement));
				destructuringAssignmentsMetric.increment({
					kind: 'direct-destructuring',
					property: key,
				});
			}
		}

		// 2.c) Handle property access and destructuring after parse calls were
		// replaced with new URL($ARG)
		const newURLAccesses = rootNode.findAll({
			rule: { pattern: `new URL($ARG).${key}` },
		});

		for (const node of newURLAccesses) {
			const baseExpr = node.text().replace(new RegExp(`\\.${key}$`), '');
			let replacement = '';

			if (key === 'auth') {
				replacement = `\`\${${baseExpr}.username}:\${${baseExpr}.password}\``;
			} else if (key === 'path') {
				replacement = `\`\${${baseExpr}.pathname}\${${baseExpr}.search}\``;
			} else if (key === 'hostname') {
				replacement = `${baseExpr}.hostname.replace(/^\\[|\\]$/, '')`;
			}
			edits.push(node.replace(replacement));
			legacyPropertyAccessesMetric.increment({
				kind: 'new-url-property-access',
				property: key,
			});
		}

		// destructuring from new URL
		const newURLDestructures = rootNode.findAll({
			rule: {
				any: [
					{ pattern: `const { ${key} } = new URL($ARG)` },
					{ pattern: `let { ${key} } = new URL($ARG)` },
					{ pattern: `var { ${key} } = new URL($ARG)` },
				],
			},
		});

		for (const node of newURLDestructures) {
			const text = node.text();
			const hadSemi = /;\s*$/.test(text);
			const rhsText = text.replace(DESTRUCTURING_ASSIGNMENT_REGEX, '');
			const declKind = text.trimStart().startsWith('var ')
				? 'var'
				: text.trimStart().startsWith('const ')
					? 'const'
					: 'let';
			const replacement = fieldsToReplace
				.find((f) => f.key === key)!
				.replaceFn(rhsText, hadSemi, declKind);
			edits.push(node.replace(replacement));
			destructuringAssignmentsMetric.increment({
				kind: 'new-url-destructuring',
				property: key,
			});
		}
	}

	filesMetric.increment({ status: edits.length ? 'migrated' : 'no-changes' });

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
};

export default transform;

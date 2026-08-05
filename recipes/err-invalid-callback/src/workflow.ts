import { useMetricAtom } from 'codemod:metrics';
import type { Codemod, Edit, SgNode } from 'codemod:ast-grep';
import type JS from 'codemod:ast-grep/langs/javascript';

const OLD_CODE = 'ERR_INVALID_CALLBACK';
const NEW_CODE = 'ERR_INVALID_ARG_TYPE';

const contextMetric = useMetricAtom('err-invalid-callback-contexts');
const filesMetric = useMetricAtom('err-invalid-callback-files');

/**
 * Classify which error-code context matched a given string fragment, for
 * metrics purposes only. Mirrors the `any` branches in the match rule above.
 */
function classifyContext(fragment: SgNode<JS>): string {
	const stringNode = fragment.parent();
	if (!stringNode) return 'unknown';

	let node = stringNode.parent();

	while (node) {
		switch (node.kind()) {
			case 'binary_expression':
				return 'binary-expression';
			case 'pair':
				return 'object-property';
			case 'switch_case':
				return 'switch-case';
			case 'arguments': {
				const call = node.parent();
				const fn = call?.find({ rule: { kind: 'member_expression' } });
				const prop = fn?.find({ rule: { kind: 'property_identifier' } });
				return prop?.text() ? `string-method:${prop.text()}` : 'string-method';
			}
			default:
				node = node.parent();
		}
	}

	return 'unknown';
}

/**
 * Remove duplicate operands in || expressions that arise from the replacement.
 *
 * After replacing ERR_INVALID_CALLBACK → ERR_INVALID_ARG_TYPE, code that previously
 * checked for both codes (e.g., `a === "ERR_INVALID_CALLBACK" || a === "ERR_INVALID_ARG_TYPE"`)
 * will have two identical conditions that should be collapsed into one.
 *
 * The regex captures a `<lhs> === <quote>ERR_INVALID_ARG_TYPE<quote>` expression,
 * then matches `|| <same expression>`. The lhs is captured with [\w.[\]"']+ to
 * support property access patterns like `err.code`, `err["code"]`, and simple identifiers.
 */
function deduplicateBinaryExpressions(code: string): string {
	return code.replace(
		/([\w.[\]"']+\s*===\s*["']ERR_INVALID_ARG_TYPE["'])\s*\|\|\s*\n?\s*\1/g,
		'$1',
	);
}

const transform: Codemod<JS> = async (root) => {
	const rootNode = root.root();
	const edits: Edit[] = [];

	// Match exact string fragments only in error-code-related AST contexts
	const stringFragments = rootNode.findAll({
		rule: {
			kind: 'string_fragment',
			regex: `^${OLD_CODE}$`,
			inside: {
				kind: 'string',
				any: [
					// err.code === "ERR_INVALID_CALLBACK"
					{ inside: { kind: 'binary_expression' } },
					// { code: "ERR_INVALID_CALLBACK" }
					{ inside: { kind: 'pair' } },
					// case "ERR_INVALID_CALLBACK":
					{ inside: { kind: 'switch_case' } },
					// .includes("ERR_INVALID_CALLBACK"), .indexOf("ERR_INVALID_CALLBACK"), etc.
					{
						inside: {
							kind: 'arguments',
							inside: {
								kind: 'call_expression',
								has: {
									kind: 'member_expression',
									has: {
										kind: 'property_identifier',
										regex: '^(includes|indexOf|match|test|startsWith|endsWith)$',
									},
								},
							},
						},
					},
				],
			},
		},
	});

	for (const fragment of stringFragments) {
		contextMetric.increment({ context: classifyContext(fragment) });
		edits.push(fragment.replace(NEW_CODE));
	}

	if (!edits.length) {
		filesMetric.increment({ status: 'no-changes' });
		return null;
	}

	let result = rootNode.commitEdits(edits);

	// Post-process: remove duplicate conditions after replacement
	// e.g., `err.code === "ERR_INVALID_ARG_TYPE" || \n    err.code === "ERR_INVALID_ARG_TYPE"`
	// becomes `err.code === "ERR_INVALID_ARG_TYPE"`
	result = deduplicateBinaryExpressions(result);

	filesMetric.increment({ status: 'migrated' });

	return result;
}

export default transform;

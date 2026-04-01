import type { Edit, SgRoot } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';

const OLD_CODE = 'ERR_INVALID_CALLBACK';
const NEW_CODE = 'ERR_INVALID_ARG_TYPE';

/**
 * Transform function that replaces references to the deprecated
 * ERR_INVALID_CALLBACK error code with ERR_INVALID_ARG_TYPE.
 *
 * See DEP0159: https://nodejs.org/api/deprecations.html#DEP0159
 *
 * Only matches string literals in error-code-related contexts:
 * - Binary comparisons: err.code === "ERR_INVALID_CALLBACK"
 * - Object properties: { code: "ERR_INVALID_CALLBACK" }
 * - Switch cases: case "ERR_INVALID_CALLBACK":
 * - String matching calls: .includes("ERR_INVALID_CALLBACK")
 *
 * Does NOT match strings used in non-error-code contexts such as
 * console.warn("ERR_INVALID_CALLBACK") or throw new Error("ERR_INVALID_CALLBACK").
 *
 * Deduplicates redundant checks after replacement (e.g., a === "X" || a === "X").
 */
export default function transform(root: SgRoot<JS>): string | null {
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
		edits.push(fragment.replace(NEW_CODE));
	}

	if (!edits.length) return null;

	let result = rootNode.commitEdits(edits);

	// Post-process: remove duplicate conditions after replacement
	// e.g., `err.code === "ERR_INVALID_ARG_TYPE" || \n    err.code === "ERR_INVALID_ARG_TYPE"`
	// becomes `err.code === "ERR_INVALID_ARG_TYPE"`
	result = deduplicateBinaryExpressions(result);

	return result;
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

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
 * Handles:
 * - String literals: "ERR_INVALID_CALLBACK" → "ERR_INVALID_ARG_TYPE"
 * - Both single and double quoted strings
 * - Deduplicates redundant checks after replacement (e.g., a === "X" || a === "X")
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	// Find all string_fragment nodes containing the old error code
	const stringFragments = rootNode.findAll({
		rule: {
			kind: 'string_fragment',
			regex: OLD_CODE,
		},
	});

	for (const fragment of stringFragments) {
		const text = fragment.text();
		const newText = text.replace(
			new RegExp(OLD_CODE, 'g'),
			NEW_CODE,
		);
		if (newText !== text) {
			edits.push(fragment.replace(newText));
		}
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

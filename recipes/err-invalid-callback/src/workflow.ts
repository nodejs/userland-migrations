import type { SgRoot, Edit } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

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
export default function transform(root: SgRoot<Js>): string | null {
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
 */
function deduplicateBinaryExpressions(code: string): string {
	// Match patterns like: <expr> || <same_expr> where both sides reference ERR_INVALID_ARG_TYPE
	return code.replace(
		/(\S+\s*===\s*["']ERR_INVALID_ARG_TYPE["'])\s*\|\|\s*\n?\s*\1/g,
		'$1',
	);
}

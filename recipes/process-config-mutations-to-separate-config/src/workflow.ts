import type { Edit, SgNode, SgRoot } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";
import { getLineIndent } from "@nodejs/codemod-utils/ast-grep/indent";

const IMMUTABLE_COMMENT = "// process.config is now immutable and cannot be modified (DEP0150)";
const DELETE_COMMENT =
	"// process.config is now immutable - properties cannot be deleted (DEP0150)";
const CONFIG_COPY_COMMENT = "// Use a separate configuration object for custom values";
const DELETE_HINT_COMMENT =
	"// If you need a modified copy, create a separate configuration object first";

/**
 * Applies the DEP0150 codemod for `process.config` mutations.
 *
 * The transform comments out unsupported direct mutations and rewrites safe
 * `Object.assign` usages to copy from `process.config` instead of mutating it.
 *
 * @param root The ast-grep root node for the current source file.
 * @returns The transformed source code, or null when no changes are needed.
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const sourceCode = rootNode.text();
	const edits: Edit[] = [];

	const writeCandidates = [
		...findProcessConfigAssignments(rootNode),
		...findProcessConfigDeletes(rootNode),
	];
	const objectAssign = findProcessConfigObjectAssign(rootNode);
	if (!writeCandidates.length && !objectAssign) return null;

	const commentedStmts = new Set<string>();

	for (const { node, headerComments } of writeCandidates) {
		const stmt = climbToStatement(node);
		if (!stmt) continue;

		const key = stmtKey(stmt);
		if (commentedStmts.has(key)) continue;

		commentedStmts.add(key);
		edits.push(stmt.replace(buildCommentBlock(sourceCode, stmt, headerComments)));
	}
	if (objectAssign) {
		const parent = objectAssign.parent();
		if (parent?.is("variable_declarator") || parent?.is("assignment_expression")) {
			const swapped = objectAssign
				.text()
				.replace(/Object\.assign\(\s*process\.config\s*,/, "Object.assign({}, process.config,");
			edits.push(objectAssign.replace(swapped));
		} else if (parent?.is("expression_statement")) {
			const stmt = parent;
			const key = stmtKey(stmt);

			if (!commentedStmts.has(key)) {
				commentedStmts.add(key);
				edits.push(
					stmt.replace(
						buildCommentBlock(sourceCode, stmt, [IMMUTABLE_COMMENT, CONFIG_COPY_COMMENT]),
					),
				);
			}
		}
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}
type WriteCandidate = { node: SgNode<JS>; headerComments: string[] };
/**
 * Finds assignment expressions that mutate `process.config`.
 *
 * This covers direct property mutations such as `process.config.foo = value`
 * and nested mutations under `process.config`.
 *
 * @param rootNode The ast-grep root node to search from.
 * @returns Matching assignment nodes that mutate `process.config`.
 */
function findProcessConfigAssignments(rootNode: SgNode<JS>): WriteCandidate[] {
	const nodes = rootNode.findAll({
		rule: {
			kind: "assignment_expression",
			has: {
				field: "left",
				any: [{ kind: "member_expression" }, { kind: "subscript_expression" }],
				regex: "^process\\.config(\\.|\\[|$)",
			},
		},
	});

	return nodes.map((node) => ({
		node,
		headerComments: [IMMUTABLE_COMMENT, CONFIG_COPY_COMMENT],
	}));
}
/**
 * Finds `Object.assign` calls that use `process.config` as the mutation target.
 *
 * These calls need special handling because they can either be rewritten to
 * copy from `process.config`, or commented out when used as a standalone mutation.
 *
 * @param rootNode The ast-grep root node to search from.
 * @returns Matching `Object.assign` call node.
 */
function findProcessConfigObjectAssign(rootNode: SgNode<JS>): SgNode<JS> {
	const node = rootNode.find({
		rule: {
			pattern: "Object.assign(process.config, $$$ARGS)",
		},
	});

	return node;
}
/**
 * Finds delete expressions that remove properties from `process.config`.
 *
 * These mutations are commented out because `process.config` is immutable and
 * deleting its properties is no longer supported.
 *
 * @param rootNode The ast-grep root node to search from.
 * @returns Matching delete expression nodes that target `process.config`.
 */
function findProcessConfigDeletes(rootNode: SgNode<JS>): WriteCandidate[] {
	const nodes = rootNode.findAll({
		rule: {
			kind: "unary_expression",
			regex: "^delete\\s+process\\.config(\\.|\\[|$)",
		},
	});

	return nodes.map((node) => ({
		node,
		headerComments: [DELETE_COMMENT, DELETE_HINT_COMMENT],
	}));
}
/**
 * Finds the nearest expression statement ancestor for a matched node.
 *
 * Returns null when the node is inside function arguments so nested
 * `Object.assign(process.config, ...)` calls can be handled separately.
 *
 * @param node The matched ast-grep node to climb from.
 * @returns The nearest expression statement ancestor, or null when none exists.
 */
function climbToStatement(node: SgNode<JS>): SgNode<JS> | null {
	let cur: SgNode<JS> | null = node.parent();
	while (cur) {
		if (cur.is("arguments")) return null;
		if (cur.is("expression_statement")) return cur;
		cur = cur.parent() ?? null;
	}

	return null;
}
/**
 * Builds a stable key for a statement based on its source position.
 *
 * This prevents applying duplicate comment edits when multiple matches are
 * found in the same statement.
 *
 * @param stmt The statement node to create a key for.
 * @returns A stable key representing the statement position.
 */
function stmtKey(stmt: SgNode<JS>): string {
	const r = stmt.range().start;

	return `${r.line}:${r.column}`;
}
/**
 * Builds the replacement text for commenting out a statement.
 *
 * The generated block preserves the original indentation and line ending, then
 * prepends explanatory comments before the commented statement body.
 *
 * @param sourceCode The full original source code.
 * @param stmt The statement node being commented out.
 * @param header The explanatory comment lines to place before the statement.
 * @returns The replacement text for the commented-out statement block.
 */
function buildCommentBlock(sourceCode: string, stmt: SgNode<JS>, header: string[]): string {
	const indent = getLineIndent(sourceCode, stmt.range().start.index);
	const lineEnding = sourceCode.includes("\r\n") ? "\r\n" : "\n";
	const bodyLines = stmt
		.text()
		.split(/\r\n|\n|\r/)
		.map((line) => `// ${line}`);
	const lines = [...header, ...bodyLines];

	return lines.map((l, i) => (i === 0 ? l : `${indent}${l}`)).join(lineEnding);
}

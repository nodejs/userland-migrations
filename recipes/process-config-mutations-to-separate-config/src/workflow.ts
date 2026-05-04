import type { Edit, SgNode, SgRoot } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";

const IMMUTABLE_COMMENT = "// process.config is now immutable and cannot be modified (DEP0150)";
const DELETE_COMMENT =
	"// process.config is now immutable - properties cannot be deleted (DEP0150)";
const CONFIG_COPY_COMMENT = "// Use a separate configuration object for custom values";
const DELETE_HINT_COMMENT =
	"// If you need a modified copy, create a separate configuration object first";

export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const sourceCode = rootNode.text();
	const edits: Edit[] = [];

	const commentedStmts = new Set<string>();

	for (const { node, headerComments } of [
		...findProcessConfigAssignments(rootNode),
		...findProcessConfigDeletes(rootNode),
	]) {
		const stmt = climbToStatement(node);
		if (!stmt) continue;
		const key = stmtKey(stmt);
		if (commentedStmts.has(key)) continue;
		commentedStmts.add(key);
		edits.push(stmt.replace(buildCommentBlock(sourceCode, stmt, headerComments)));
	}

	for (const { node } of findProcessConfigObjectAssigns(rootNode)) {
		const parentKind = node.parent()?.kind();

		if (parentKind === "variable_declarator" || parentKind === "assignment_expression") {
			const swapped = node
				.text()
				.replace(/Object\.assign\(\s*process\.config\s*,/, "Object.assign({}, process.config,");
			edits.push(node.replace(swapped));
			continue;
		}

		if (parentKind === "expression_statement") {
			const stmt = node.parent()!;
			const key = stmtKey(stmt);
			if (commentedStmts.has(key)) continue;
			commentedStmts.add(key);
			edits.push(
				stmt.replace(
					buildCommentBlock(sourceCode, stmt, [
						IMMUTABLE_COMMENT,
						CONFIG_COPY_COMMENT,
					]),
				),
			);
		}
	}
	if (!edits.length) return null;
	return rootNode.commitEdits(edits);
}

type WriteCandidate = { node: SgNode<JS>; headerComments: string[] };
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

function findProcessConfigObjectAssigns(rootNode: SgNode<JS>): { node: SgNode<JS> }[] {
	const nodes = rootNode.findAll({
		rule: {
			pattern: "Object.assign(process.config, $$$ARGS)",
		},
	});
	return nodes.map((node) => ({ node }));
}

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
function climbToStatement(node: SgNode<JS>): SgNode<JS> | null {
	let cur: SgNode<JS> | null = node;
	for (let i = 0; i < 3 && cur; i++) {
		if (cur.kind() === "expression_statement") return cur;
		cur = cur.parent() ?? null;
	}
	return null;
}
function stmtKey(stmt: SgNode<JS>): string {
	const r = stmt.range().start;
	return `${r.line}:${r.column}`;
}
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
function getLineIndent(sourceCode: string, index: number): string {
	const lineStart = sourceCode.lastIndexOf("\n", index - 1) + 1;
	const linePrefix = sourceCode.slice(lineStart, index);
	return linePrefix.match(/^[\t ]*/)?.[0] ?? "";
}

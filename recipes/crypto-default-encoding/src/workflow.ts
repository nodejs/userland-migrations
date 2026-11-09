import { getLineIndent } from '@nodejs/codemod-utils/ast-grep/indent';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { removeBinding } from '@nodejs/codemod-utils/ast-grep/remove-binding';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import type { Edit, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

type Accessor = {
	/** Local path the property is reached through, e.g. `crypto.DEFAULT_ENCODING` or `DEFAULT_ENCODING`. */
	path: string;
	/** The `require`/`import` statement the path was resolved from. */
	statement: SgNode<Js>;
	/** `true` when the property is reached through a namespace binding. */
	namespaced: boolean;
};

type Replacement = {
	start: number;
	end: number;
	text: string;
};

/**
 * Marker left behind by edits whose node should disappear along with its line.
 * `replace()` cannot cover the trailing newline, so the line is dropped in a
 * final pass over the committed source.
 */
const DROP_LINE = '/*__dep0091_drop_line__*/';

/** `crypto.DEFAULT_ENCODING` defaulted to `'buffer'` for its whole lifetime. */
const IMPLICIT_DEFAULT = '"buffer"';

const REMOVED =
	'// DEP0091: `crypto.DEFAULT_ENCODING` was removed in Node.js v20.';
const INLINED =
	'// DEP0091: `crypto.DEFAULT_ENCODING` was removed in Node.js v20; its value is inlined here.';
const PASS_EXPLICITLY =
	'// Pass the encoding explicitly to each crypto call instead, e.g. `hash.digest("hex")`.';
const REVIEW_READ =
	'// TODO(DEP0091): `crypto.DEFAULT_ENCODING` was removed in Node.js v20; give this read an explicit encoding.';

/** Receivers whose `digest()` honoured `crypto.DEFAULT_ENCODING`. */
const HASH_FACTORIES = ['createHash', 'createHmac'];

/**
 * Transform function that handles the removal of `crypto.DEFAULT_ENCODING`
 * (DEP0091, end-of-life in Node.js v20).
 *
 * Handles:
 * 1. `crypto.DEFAULT_ENCODING` reads → the value the property resolved to
 * 2. `crypto.DEFAULT_ENCODING || fallback` → the same value, the dead fallback dropped
 * 3. `crypto.DEFAULT_ENCODING = "hex"` → removed, the encoding pushed into `digest()`
 * 4. `const { DEFAULT_ENCODING } = require("node:crypto")` → binding removed
 * 5. Reads that cannot be resolved statically → left in place, flagged for review
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const source = rootNode.text();

	const statements = getModuleDependencies(root, 'crypto');

	// No imports or requires for 'crypto', skip transformation
	if (!statements.length) return null;

	const accessors: Accessor[] = [];

	for (const statement of statements) {
		const path = resolveBindingPath(statement, '$.DEFAULT_ENCODING');
		if (!path) continue;

		accessors.push({ path, statement, namespaced: path.includes('.') });
	}

	if (!accessors.length) return null;

	const assignments = dedupe(
		accessors.flatMap((accessor) => findAssignments(rootNode, accessor)),
	);
	const assignmentStatements = new Set(
		assignments.map((assignment) => enclosingStatement(assignment).id()),
	);
	const reads = dedupe(
		accessors.flatMap((accessor) => findReads(rootNode, accessor)),
	).filter((read) => !assignmentStatements.has(enclosingStatement(read).id()));

	// `crypto.DEFAULT_ENCODING` was a plain string property, so a read resolves to
	// the last value assigned to it, or to its default when nothing assigned it.
	const assignedValue = resolveAssignedValue(assignments);
	const resolvedValue = assignments.length ? assignedValue : IMPLICIT_DEFAULT;

	// An assignment used to change the output encoding of every later crypto call,
	// so dropping it on its own would silently turn strings back into buffers.
	const digestTargets = assignedValue
		? collectDigestTargets(rootNode, statements, assignedValue)
		: [];

	const edits: Edit[] = [];

	for (const accessor of accessors) {
		if (accessor.namespaced) continue;

		const result = removeBinding(accessor.statement, accessor.path);
		if (result?.edit) edits.push(result.edit);
		if (result?.lineToRemove) {
			edits.push(enclosingStatement(accessor.statement).replace(DROP_LINE));
		}
	}

	const noticedBlocks = new Set<number>();

	for (const assignment of assignments) {
		const statement = enclosingStatement(assignment);

		// The encoding survives in the calls it used to govern, so the assignment
		// itself can go without leaving anything for the reader to act on.
		// A block that already carries the notice does not need it twice either.
		const block = statement.parent()?.id() ?? -1;

		if (digestTargets.length || noticedBlocks.has(block)) {
			edits.push(statement.replace(DROP_LINE));
			continue;
		}

		noticedBlocks.add(block);

		const indent = getLineIndent(source, statement.range().start.index);
		edits.push(statement.replace(`${REMOVED}\n${indent}${PASS_EXPLICITLY}`));
	}

	const groupedReads = groupByStatement(reads);
	const claimed = new Set<number>();

	for (const [, group] of groupedReads) {
		const statement = enclosingStatement(group[0]);
		const indent = getLineIndent(source, statement.range().start.index);

		if (!resolvedValue) {
			edits.push(
				statement.replace(`${REVIEW_READ}\n${indent}${statement.text()}`),
			);
			continue;
		}

		const replacements: Replacement[] = group.map((read) => {
			const target = foldableOperand(read) ?? read;
			return { ...rangeOf(target), text: resolvedValue };
		});

		// A `digest()` call sitting in the same statement has to be rewritten here
		// rather than as its own edit, or the two edits would overlap.
		for (const target of digestTargets) {
			if (!isWithin(target.node, statement)) continue;
			claimed.add(target.node.id());
			replacements.push({ ...rangeOf(target.node), text: target.text });
		}

		edits.push(
			statement.replace(
				`${INLINED}\n${indent}${applyReplacements(statement, replacements)}`,
			),
		);
	}

	for (const target of digestTargets) {
		if (claimed.has(target.node.id())) continue;
		edits.push(target.node.replace(target.text));
	}

	if (!edits.length) return null;

	return dropMarkedLines(rootNode.commitEdits(edits));
}

/** Collect every `<path> = <value>` assignment of the property. */
function findAssignments(
	rootNode: SgNode<Js>,
	accessor: Accessor,
): SgNode<Js>[] {
	return rootNode.findAll({
		rule: {
			kind: 'assignment_expression',
			has: { field: 'left', pattern: accessor.path },
		},
	});
}

/** Collect every read of the property, excluding assignment targets and bindings. */
function findReads(rootNode: SgNode<Js>, accessor: Accessor): SgNode<Js>[] {
	const matches = accessor.namespaced
		? rootNode.findAll({
				rule: { kind: 'member_expression', pattern: accessor.path },
			})
		: rootNode.findAll({
				rule: {
					kind: 'identifier',
					pattern: accessor.path,
					not: {
						inside: {
							any: [
								{ kind: 'import_statement' },
								{ kind: 'import_specifier' },
								{ kind: 'named_imports' },
								{ kind: 'object_pattern' },
								{ kind: 'pair_pattern' },
							],
						},
					},
				},
			});

	return matches.filter((match) => !isAssignmentTarget(match));
}

function isAssignmentTarget(node: SgNode<Js>): boolean {
	const parent = node.parent();
	if (!parent) return false;

	const kind = parent.kind();
	if (
		kind !== 'assignment_expression' &&
		kind !== 'augmented_assignment_expression'
	) {
		return false;
	}

	const left = parent.field('left');

	return Boolean(left) && sameRange(left, node);
}

/**
 * The property always held a non-empty string, so `DEFAULT_ENCODING || fallback`
 * (and its `??` form) never reached the fallback. Return the whole expression so
 * the dead branch goes away with the read.
 */
function foldableOperand(read: SgNode<Js>): SgNode<Js> | undefined {
	const parent = read.parent();
	if (!parent) return undefined;
	if (parent.kind() !== 'binary_expression') return undefined;

	const operator = parent.field('operator')?.text();
	if (operator !== '||' && operator !== '??') return undefined;

	const left = parent.field('left');

	return left && sameRange(left, read) ? parent : undefined;
}

/**
 * The value a read resolves to, or `undefined` when the file assigns something
 * this codemod cannot evaluate (a variable, a conditional, two different literals).
 */
function resolveAssignedValue(assignments: SgNode<Js>[]): string | undefined {
	const literals = new Set<string>();

	for (const assignment of assignments) {
		const value = assignment.field('right');
		if (!value) return undefined;
		if (value.kind() !== 'string') return undefined;

		literals.add(value.text());
	}

	return literals.size === 1 ? [...literals][0] : undefined;
}

/**
 * Find the `digest()` calls that relied on the assigned encoding. Only hashes and
 * HMACs are tracked: their `digest()` takes the encoding as its single argument,
 * so pushing it down is unambiguous.
 */
function collectDigestTargets(
	rootNode: SgNode<Js>,
	statements: SgNode<Js>[],
	value: string,
): { node: SgNode<Js>; text: string }[] {
	const factories = new Set<string>();

	for (const statement of statements) {
		for (const factory of HASH_FACTORIES) {
			const binding = resolveBindingPath(statement, `$.${factory}`);
			if (binding) factories.add(binding);
		}
	}

	if (!factories.size) return [];

	const variables = new Set<string>();

	for (const factory of factories) {
		for (const call of rootNode.findAll({
			rule: { kind: 'call_expression', pattern: `${factory}($$$ARGS)` },
		})) {
			const name = closestAncestor(call, 'variable_declarator')?.field('name');
			if (name?.kind() === 'identifier') variables.add(name.text());
		}
	}

	const targets: { node: SgNode<Js>; text: string }[] = [];

	for (const call of rootNode.findAll({
		rule: { pattern: '$RECEIVER.digest()' },
	})) {
		const receiver = call.getMatch('RECEIVER');
		if (!receiver) continue;

		const text = receiver.text();
		const known =
			variables.has(text) ||
			[...variables].some((variable) => text.startsWith(`${variable}.`)) ||
			[...factories].some((factory) => text.includes(`${factory}(`));

		if (!known) continue;

		targets.push({ node: call, text: `${text}.digest(${value})` });
	}

	return targets;
}

/** Group nodes by the statement they belong to, preserving source order. */
function groupByStatement(nodes: SgNode<Js>[]): Map<number, SgNode<Js>[]> {
	const groups = new Map<number, SgNode<Js>[]>();

	for (const node of nodes) {
		const id = enclosingStatement(node).id();
		const group = groups.get(id);

		if (group) group.push(node);
		else groups.set(id, [node]);
	}

	return groups;
}

/** Walk up to the statement that owns `node` within its block. */
function enclosingStatement(node: SgNode<Js>): SgNode<Js> {
	let current = node;

	while (true) {
		const parent = current.parent();
		if (!parent) return current;

		const kind = parent.kind();
		if (
			kind === 'program' ||
			kind === 'statement_block' ||
			kind === 'class_body'
		) {
			return current;
		}

		current = parent;
	}
}

function closestAncestor(
	node: SgNode<Js>,
	kind: string,
): SgNode<Js> | undefined {
	return node.ancestors().find((ancestor) => ancestor.kind() === kind);
}

/** Rewrite `statement` by splicing `replacements` into its text. */
function applyReplacements(
	statement: SgNode<Js>,
	replacements: Replacement[],
): string {
	const offset = statement.range().start.index;
	let text = statement.text();

	for (const replacement of [...replacements].sort(
		(a, b) => b.start - a.start,
	)) {
		text =
			text.slice(0, replacement.start - offset) +
			replacement.text +
			text.slice(replacement.end - offset);
	}

	return text;
}

function rangeOf(node: SgNode<Js>): { start: number; end: number } {
	const range = node.range();

	return { start: range.start.index, end: range.end.index };
}

function isWithin(node: SgNode<Js>, container: SgNode<Js>): boolean {
	const inner = rangeOf(node);
	const outer = rangeOf(container);

	return inner.start >= outer.start && inner.end <= outer.end;
}

function sameRange(a: SgNode<Js>, b: SgNode<Js>): boolean {
	const left = rangeOf(a);
	const right = rangeOf(b);

	return left.start === right.start && left.end === right.end;
}

function dedupe(nodes: SgNode<Js>[]): SgNode<Js>[] {
	const seen = new Set<number>();

	return nodes.filter((node) => {
		if (seen.has(node.id())) return false;

		seen.add(node.id());

		return true;
	});
}

function dropMarkedLines(source: string): string {
	const lines = source.split('\n');
	const kept: string[] = [];

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];

		if (line.trim() !== DROP_LINE) {
			kept.push(
				line.includes(DROP_LINE) ? line.replaceAll(DROP_LINE, '') : line,
			);
			continue;
		}

		// Removing the line must not leave the blank lines that surrounded it
		// doubled up, nor a blank line at the top of the file.
		const previous = kept.at(-1);
		const next = lines[index + 1];

		if (
			(previous === undefined || !previous.trim()) &&
			next !== undefined &&
			!next.trim()
		) {
			index++;
		}
	}

	return kept.join('\n');
}

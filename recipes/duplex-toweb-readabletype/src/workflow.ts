import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import type { Edit, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

const DEPRECATED_KEY = 'type';
const REPLACEMENT_KEY = 'readableType';

/**
 * Handle DEP0201: rename the `type` option passed to `Duplex.toWeb()` to
 * `readableType`.
 *
 * Only inline object literals are rewritten. Options objects that are shared,
 * spread, or contain keys whose meaning cannot be resolved statically are left
 * unchanged so that the migration never alters runtime behaviour.
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const callees = collectToWebCallees(root);

	if (!callees.size) return null;

	for (const callee of callees) {
		const calls = rootNode.findAll<'call_expression'>({
			rule: {
				kind: 'call_expression',
				has: {
					field: 'function',
					kind: callee.includes('.') ? 'member_expression' : 'identifier',
					pattern: callee,
				},
			},
		});

		for (const call of calls) {
			processToWebCall(root, call, edits);
		}
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

function collectToWebCallees(root: SgRoot<Js>): Set<string> {
	const callees = new Set<string>();

	for (const statement of getModuleDependencies(root, 'stream')) {
		const binding = resolveBindingPath(statement, '$.Duplex.toWeb');

		if (binding) callees.add(binding);
	}

	return callees;
}

function processToWebCall(
	root: SgRoot<Js>,
	call: SgNode<Js>,
	edits: Edit[],
): void {
	const args = call.field('arguments');
	if (!args) return;

	const options = args.children().filter((child) => child.isNamed())[1];

	if (options?.kind() !== 'object') return;

	const entries = options.children().filter((child) => child.isNamed());
	const typeEntries = entries.filter(
		(entry) => getEntryKey(entry) === DEPRECATED_KEY,
	);

	if (!typeEntries.length) return;

	const hasReplacementKey = entries.some(
		(entry) => getEntryKey(entry) === REPLACEMENT_KEY,
	);

	if (hasReplacementKey) {
		warn(
			root,
			call,
			`Duplex.toWeb() receives both \`${DEPRECATED_KEY}\` and \`${REPLACEMENT_KEY}\`; \`${REPLACEMENT_KEY}\` takes precedence. Remove \`${DEPRECATED_KEY}\` manually after review (DEP0201).`,
		);
		return;
	}

	if (typeEntries.length > 1 || entries.some(isUnresolvedEntry)) {
		warn(
			root,
			call,
			`Duplex.toWeb() options cannot be migrated safely; rename \`${DEPRECATED_KEY}\` to \`${REPLACEMENT_KEY}\` manually (DEP0201).`,
		);
		return;
	}

	const [entry] = typeEntries;

	if (entry.kind() === 'shorthand_property_identifier') {
		edits.push(entry.replace(`${REPLACEMENT_KEY}: ${entry.text()}`));
		return;
	}

	const key = entry.field('key');
	if (!key) return;

	if (key.kind() === 'string') {
		const quote = key.text()[0];
		edits.push(key.replace(`${quote}${REPLACEMENT_KEY}${quote}`));
		return;
	}

	edits.push(key.replace(REPLACEMENT_KEY));
}

/**
 * Returns the static key of an object entry, or `null` when the entry has no
 * key (spread) or its key cannot be resolved statically (computed).
 */
function getEntryKey(entry: SgNode<Js>): string | null {
	const kind = entry.kind();

	if (kind === 'shorthand_property_identifier') return entry.text();

	if (kind !== 'pair' && kind !== 'method_definition') return null;

	const key = entry.field(kind === 'pair' ? 'key' : 'name');
	if (!key) return null;

	switch (key.kind()) {
		case 'property_identifier':
			return key.text();
		case 'string': {
			const fragment = key.find({ rule: { kind: 'string_fragment' } });
			return fragment ? fragment.text() : '';
		}
		default:
			return null;
	}
}

/**
 * Entries that may hide or redefine `type`/`readableType`: spreads, computed
 * keys, getters, setters, and methods.
 */
function isUnresolvedEntry(entry: SgNode<Js>): boolean {
	const kind = entry.kind();

	if (kind === 'spread_element' || kind === 'method_definition') return true;

	if (kind === 'pair') {
		return entry.field('key')?.kind() === 'computed_property_name';
	}

	return false;
}

function warn(root: SgRoot<Js>, node: SgNode<Js>, message: string): void {
	const { start } = node.range();

	console.warn(
		`${root.filename()}:${start.line + 1}:${start.column + 1}: ${message}`,
	);
}

import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import type { Edit, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

const NUMERIC_OPTIONS = new Set(['family', 'hints']);
const BOOLEAN_OPTIONS = new Set(['all', 'verbatim']);

export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const lookupCallees = collectLookupCallees(root);

	if (!lookupCallees.size) return null;

	for (const callee of lookupCallees) {
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
			processLookupCall(call, edits);
		}
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

function collectLookupCallees(root: SgRoot<Js>): Set<string> {
	const callees = new Set<string>();

	for (const statement of getModuleDependencies(root, 'dns')) {
		addResolvedBinding(callees, statement, '$.lookup');
		addResolvedBinding(callees, statement, '$.promises.lookup');
	}

	for (const statement of getModuleDependencies(root, 'dns/promises')) {
		addResolvedBinding(callees, statement, '$.lookup');
	}

	return callees;
}

function addResolvedBinding(
	callees: Set<string>,
	statement: SgNode<Js>,
	path: string,
): void {
	const binding = resolveBindingPath(statement, path);

	if (binding) {
		callees.add(binding);
	}
}

/**
 * Rewrites the second argument only when it is an inline options object.
 *
 * DEP0153 affects option values, so calls without options or with a shared
 * options variable are intentionally left unchanged for manual review.
 */
function processLookupCall(call: SgNode<Js>, edits: Edit[]): void {
	const args = call.field('arguments');
	if (!args) return;

	const optionArg = args.children().filter((child) => child.isNamed())[1];

	if (!optionArg || optionArg.kind() !== 'object') return;

	edits.push(...transformOptionsObject(optionArg));
}

/**
 * Converts known dns.lookup option keys when the value can be replaced without
 * changing surrounding code. Other keys are ignored so this recipe stays scoped
 * to the DEP0153 runtime coercions.
 */
function transformOptionsObject(options: SgNode<Js>): Edit[] {
	const edits: Edit[] = [];
	const pairs = options.findAll<'pair'>({ rule: { kind: 'pair' } });

	for (const pair of pairs) {
		const key = getOptionKey(pair);
		const value = pair.field('value');

		if (!key || !value) continue;

		const replacement = getValueReplacement(key, value);

		if (replacement !== null) {
			edits.push(value.replace(replacement));
		}
	}

	return edits;
}

function getOptionKey(pair: SgNode<Js, 'pair'>): string | null {
	const key = pair.field('key');
	if (!key) return null;

	const keyKind = key.kind();
	if (keyKind === 'property_identifier') {
		return key.text();
	}

	if (keyKind === 'string') {
		return getStringLiteralValue(key);
	}

	return null;
}

/**
 * Returns a replacement for deprecated literal coercions only.
 *
 * Semantic propagation for identifiers is deliberately avoided here: options
 * objects can be reused, mutated, or passed through helpers, and an unsafe
 * rewrite would be harder to review than leaving those cases for the user.
 */
function getValueReplacement(key: string, value: SgNode<Js>): string | null {
	if (NUMERIC_OPTIONS.has(key)) {
		return getNumericReplacement(value);
	}

	if (BOOLEAN_OPTIONS.has(key)) {
		return getBooleanReplacement(value);
	}

	return null;
}

function getNumericReplacement(value: SgNode<Js>): string | null {
	const valueKind = value.kind();

	switch (valueKind) {
		case 'string': {
			const stringValue = getStringLiteralValue(value);
			if (!stringValue || !/^\d+$/.test(stringValue)) return null;

			return String(Number.parseInt(stringValue, 10));
		}
		default:
			return null;
	}
}

function getBooleanReplacement(value: SgNode<Js>): string | null {
	const valueKind = value.kind();

	switch (valueKind) {
		case 'number':
			if (value.text() === '0') return 'false';
			if (value.text() === '1') return 'true';
			return null;
		case 'string': {
			const stringValue = getStringLiteralValue(value);
			return stringValue === 'true' || stringValue === 'false'
				? stringValue
				: null;
		}
		default:
			return null;
	}
}

function getStringLiteralValue(node: SgNode<Js>): string | null {
	const stringFragment = node.find({ rule: { kind: 'string_fragment' } });

	if (stringFragment) {
		return stringFragment.text();
	}

	const text = node.text();

	return text.length >= 2 ? text.slice(1, -1) : null;
}

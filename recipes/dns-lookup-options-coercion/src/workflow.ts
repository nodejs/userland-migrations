import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import type { Edit, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

const NUMERIC_OPTIONS = new Set(['family', 'hints']);
const BOOLEAN_OPTIONS = new Set(['all', 'verbatim']);
const IGNORED_ARGUMENT_KINDS = new Set([',', '(', ')']);

export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const lookupCallees = collectLookupCallees(root);

	if (lookupCallees.size === 0) return null;

	for (const callee of lookupCallees) {
		const calls = rootNode.findAll({
			rule: { pattern: `${callee}($$$_ARGS)` },
		});

		for (const call of calls) {
			edits.push(...transformLookupCall(call));
		}
	}

	if (edits.length === 0) return null;

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

function transformLookupCall(call: SgNode<Js>): Edit[] {
	const args = call.field('arguments');
	if (!args) return [];

	const optionArg = args
		.children()
		.filter((child) => !IGNORED_ARGUMENT_KINDS.has(child.kind()))[1];

	if (!optionArg || optionArg.kind() !== 'object') return [];

	return transformOptionsObject(optionArg);
}

function transformOptionsObject(options: SgNode<Js>): Edit[] {
	const edits: Edit[] = [];
	const pairs = options.children().filter((child) => child.kind() === 'pair');

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

function getOptionKey(pair: SgNode<Js>): string | null {
	const key = pair.field('key');
	if (!key) return null;

	if (key.kind() === 'property_identifier') {
		return key.text();
	}

	if (key.kind() === 'string') {
		return getStringLiteralValue(key);
	}

	return null;
}

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
	if (value.kind() !== 'string') return null;

	const stringValue = getStringLiteralValue(value);
	if (!stringValue || !/^\d+$/.test(stringValue)) return null;

	return String(Number.parseInt(stringValue, 10));
}

function getBooleanReplacement(value: SgNode<Js>): string | null {
	if (value.kind() === 'number') {
		if (value.text() === '0') return 'false';
		if (value.text() === '1') return 'true';
	}

	if (value.kind() !== 'string') return null;

	const stringValue = getStringLiteralValue(value);
	if (stringValue === 'true') return 'true';
	if (stringValue === 'false') return 'false';

	return null;
}

function getStringLiteralValue(node: SgNode<Js>): string | null {
	const stringFragment = node.find({ rule: { kind: 'string_fragment' } });

	if (stringFragment) {
		return stringFragment.text();
	}

	const text = node.text();

	return text.length >= 2 ? text.slice(1, -1) : null;
}

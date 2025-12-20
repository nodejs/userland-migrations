import { EOL } from 'node:os';
import dedent from 'dedent';
import {
	getNodeImportCalls,
	getNodeImportStatements,
} from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import type { Edit, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

type CallKind = 'cipher' | 'decipher';

type StatementChange = {
	rename: Map<string, string>;
	additions: Set<string>;
};

type BindingEntry = {
	property: string;
	local: string;
};

type CollectParams = {
	rootNode: SgNode<Js>;
	statement: SgNode<Js>;
	binding: string;
	kind: CallKind;
	edits: Edit[];
	statementChanges: Map<SgNode<Js>, StatementChange>;
	seenCallRanges: Set<string>;
};

/**
 * Transform deprecated crypto.createCipher()/createDecipher() usage to the
 * supported crypto.createCipheriv()/createDecipheriv() APIs.
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const statementChanges = new Map<SgNode<Js>, StatementChange>();
	const seenCallRanges = new Set<string>();

	for (const statement of collectCryptoStatements(root)) {
		const cipherBinding = safeResolveBinding(statement, '$.createCipher');
		if (cipherBinding) {
			collectCallEdits({
				rootNode,
				statement,
				binding: cipherBinding,
				kind: 'cipher',
				edits,
				statementChanges,
				seenCallRanges,
			});
		}

		const decipherBinding = safeResolveBinding(statement, '$.createDecipher');
		if (decipherBinding) {
			collectCallEdits({
				rootNode,
				statement,
				binding: decipherBinding,
				kind: 'decipher',
				edits,
				statementChanges,
				seenCallRanges,
			});
		}
	}

	for (const [statement, change] of statementChanges) {
		const edit = applyStatementChanges(statement, change);
		if (edit) edits.push(edit);
	}

	if (edits.length === 0) return null;

	return rootNode.commitEdits(edits);
}

function collectCallEdits({
	rootNode,
	statement,
	binding,
	kind,
	edits,
	statementChanges,
	seenCallRanges,
}: CollectParams) {
	const patterns = [
		`${binding}($ALGORITHM, $PASSWORD, $OPTIONS)`,
		`${binding}($ALGORITHM, $PASSWORD)`,
	];

	const calls = rootNode.findAll({
		rule: {
			any: patterns.map((pattern) => ({ pattern })),
			kind: 'call_expression',
		},
	});

	for (const call of calls) {
		const rangeKey = getRangeKey(call);
		if (seenCallRanges.has(rangeKey)) continue;
		seenCallRanges.add(rangeKey);

		const algorithmNode = call.getMatch('ALGORITHM');
		const passwordNode = call.getMatch('PASSWORD');

		if (!algorithmNode || !passwordNode) continue;

		const algorithm = algorithmNode.text().trim();
		const password = passwordNode.text().trim();
		if (!algorithm || !password) continue;

		const optionsText = call.getMatch('OPTIONS')?.text()?.trim();

		const replacement =
			kind === 'cipher'
				? buildCipherReplacement({
						binding,
						algorithm,
						password,
						options: optionsText,
					})
				: buildDecipherReplacement({
						binding,
						algorithm,
						password,
						options: optionsText,
					});

		edits.push(call.replace(replacement));

		if (isDestructuredStatement(statement)) {
			const change = ensureStatementChange(statementChanges, statement);
			// Ensure the binding points to the iv-based API
			const sourceName = kind === 'cipher' ? 'createCipher' : 'createDecipher';
			const targetName = `${sourceName}iv`;
			change.rename.set(sourceName, targetName);
			if (kind === 'cipher') {
				change.additions.add('randomBytes');
			}
			change.additions.add('scryptSync');
		}
	}
}

function buildCipherReplacement(params: {
	binding: string;
	algorithm: string;
	password: string;
	options?: string;
}): string {
	const { binding, algorithm, password, options } = params;
	const randomBytesCall = getMemberAccess(binding, 'randomBytes');
	const scryptCall = getMemberAccess(binding, 'scryptSync');
	const cipherCall = getCallableBinding(binding, 'createCipheriv');

	return dedent(`
	(() => {
		const __dep0106Salt = ${randomBytesCall}(16);
		const __dep0106Key = ${scryptCall}(${password}, __dep0106Salt, 32);
		const __dep0106Iv = ${randomBytesCall}(16);
		// DEP0106: Persist __dep0106Salt and __dep0106Iv with the ciphertext so it can be decrypted later.
		// DEP0106: Adjust the derived key length (32 bytes) and IV length to match the chosen algorithm.
		return ${cipherCall}(${algorithm}, __dep0106Key, __dep0106Iv${options ? `, ${options}` : ''});
	})()
`);
}

function buildDecipherReplacement(params: {
	binding: string;
	algorithm: string;
	password: string;
	options?: string;
}): string {
	const { binding, algorithm, password, options } = params;
	const scryptCall = getMemberAccess(binding, 'scryptSync');
	const decipherCall = getCallableBinding(binding, 'createDecipheriv');

	return dedent(`
	(() => {
		// DEP0106: Replace the placeholders below with the salt and IV that were stored with the ciphertext.
		const __dep0106Salt = /* TODO: stored salt Buffer */ Buffer.alloc(16);
		const __dep0106Iv = /* TODO: stored IV Buffer */ Buffer.alloc(16);
		const __dep0106Key = ${scryptCall}(${password}, __dep0106Salt, 32);
		// DEP0106: Ensure __dep0106Salt and __dep0106Iv match the values used during encryption.
		return ${decipherCall}(${algorithm}, __dep0106Key, __dep0106Iv${options ? `, ${options}` : ''});
	})()
`);
}

function getCallableBinding(binding: string, target: string): string {
	const lastDot = binding.lastIndexOf('.');
	if (lastDot === -1) {
		return binding;
	}
	return `${binding.slice(0, lastDot)}.${target}`;
}

function getMemberAccess(binding: string, member: string): string {
	const lastDot = binding.lastIndexOf('.');
	if (lastDot === -1) {
		return member;
	}
	return `${binding.slice(0, lastDot)}.${member}`;
}

function isDestructuredStatement(statement: SgNode<Js>): boolean {
	return Boolean(
		statement.find({ rule: { kind: 'object_pattern' } }) ||
			statement.find({ rule: { kind: 'named_imports' } }),
	);
}

function ensureStatementChange(
	statementChanges: Map<SgNode<Js>, StatementChange>,
	statement: SgNode<Js>,
): StatementChange {
	let change = statementChanges.get(statement);
	if (!change) {
		change = { rename: new Map(), additions: new Set() };
		statementChanges.set(statement, change);
	}
	return change;
}

function applyStatementChanges(
	statement: SgNode<Js>,
	change: StatementChange,
): Edit | undefined {
	if (change.rename.size === 0 && change.additions.size === 0) {
		return undefined;
	}

	if (
		statement.kind() === 'import_statement' ||
		statement.kind() === 'import_clause'
	) {
		return updateImportSpecifiers(statement, change);
	}

	if (statement.find({ rule: { kind: 'object_pattern' } })) {
		return updateRequirePattern(statement, change);
	}

	return undefined;
}

function updateImportSpecifiers(
	statement: SgNode<Js>,
	change: StatementChange,
): Edit | undefined {
	const clause =
		statement.kind() === 'import_clause'
			? statement
			: statement.find({ rule: { kind: 'import_clause' } });
	if (!clause) return undefined;

	const namedImports = clause.find({ rule: { kind: 'named_imports' } });
	if (!namedImports) return undefined;

	const specNodes = namedImports.findAll({
		rule: { kind: 'import_specifier' },
	});
	if (specNodes.length === 0) return undefined;

	const entries: BindingEntry[] = specNodes.map((spec) =>
		parseImportSpecifier(spec.text()),
	);
	let modified = false;

	for (const entry of entries) {
		const newProperty = change.rename.get(entry.property);
		if (newProperty && newProperty !== entry.property) {
			entry.property = newProperty;
			modified = true;
		}
	}

	for (const addition of change.additions) {
		const exists = entries.some(
			(entry) => entry.property === addition || entry.local === addition,
		);
		if (!exists) {
			entries.push({ property: addition, local: addition });
			modified = true;
		}
	}

	if (!modified) return undefined;

	const rendered = entries
		.map((entry) =>
			entry.property === entry.local
				? entry.property
				: `${entry.property} as ${entry.local}`,
		)
		.join(', ');

	return namedImports.replace(`{ ${rendered} }`);
}

function updateRequirePattern(
	statement: SgNode<Js>,
	change: StatementChange,
): Edit | undefined {
	const objectPattern = statement.find({ rule: { kind: 'object_pattern' } });
	if (!objectPattern) return undefined;

	const specNodes = objectPattern.findAll({
		rule: {
			any: [
				{ kind: 'pair_pattern' },
				{ kind: 'shorthand_property_identifier_pattern' },
			],
		},
	});
	if (specNodes.length === 0) return undefined;

	const entries: BindingEntry[] = specNodes.map((spec) =>
		parseRequireSpecifier(spec.text()),
	);
	let modified = false;

	for (const entry of entries) {
		const newProperty = change.rename.get(entry.property);
		if (newProperty && newProperty !== entry.property) {
			entry.property = newProperty;
			modified = true;
		}
	}

	for (const addition of change.additions) {
		const exists = entries.some(
			(entry) => entry.property === addition || entry.local === addition,
		);
		if (!exists) {
			entries.push({ property: addition, local: addition });
			modified = true;
		}
	}

	if (!modified) return undefined;

	const rendered = entries
		.map((entry) =>
			entry.property === entry.local
				? entry.property
				: `${entry.property}: ${entry.local}`,
		)
		.join(', ');

	return objectPattern.replace(`{ ${rendered} }`);
}

function parseImportSpecifier(text: string): BindingEntry {
	const parts = text
		.split(/\s+as\s+/)
		.map((value) => value.trim())
		.filter(Boolean);
	if (parts.length === 2) {
		return { property: parts[0], local: parts[1] };
	}
	const name = parts[0] ?? text.trim();
	return { property: name, local: name };
}

function parseRequireSpecifier(text: string): BindingEntry {
	const parts = text
		.split(':')
		.map((value) => value.trim())
		.filter(Boolean);
	if (parts.length === 2) {
		return { property: parts[0], local: parts[1] };
	}
	const name = parts[0] ?? text.trim();
	return { property: name, local: name };
}

function collectCryptoStatements(root: SgRoot<Js>): SgNode<Js>[] {
	return [
		...getNodeImportStatements(root, 'crypto'),
		...getNodeImportCalls(root, 'crypto'),
		...getNodeRequireCalls(root, 'crypto'),
	];
}

function safeResolveBinding(
	node: SgNode<Js>,
	path: string,
): string | undefined {
	try {
		return resolveBindingPath(node, path) ?? undefined;
	} catch {
		return undefined;
	}
}

function getRangeKey(node: SgNode<Js>): string {
	const range = node.range();
	return `${range.start.line}:${range.start.column}-${range.end.line}:${range.end.column}`;
}

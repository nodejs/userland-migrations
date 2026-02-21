import dedent from 'dedent';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import type { Edit, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

type CallKind = 'cipher' | 'decipher';

type CollectParams = {
	rootNode: SgNode<Js>;
	statement: SgNode<Js>;
	binding: string;
	kind: CallKind;
	edits: Edit[];
	seenCallRanges: Set<string>;
};

/**
 * Transform deprecated crypto.createCipher()/createDecipher() usage to the
 * supported crypto.createCipheriv()/createDecipheriv() APIs.
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const seenCallRanges = new Set<string>();

	const importStatements = getModuleDependencies(root, 'crypto');

	if (!importStatements.length) return null;

	for (const statement of importStatements) {
		const cipherBinding = resolveBindingPath(statement, '$.createCipher');
		collectCallEdits({
			rootNode,
			statement,
			binding: cipherBinding,
			kind: 'cipher',
			edits,
			seenCallRanges,
		});

		const decipherBinding = resolveBindingPath(statement, '$.createDecipher');
		collectCallEdits({
			rootNode,
			statement,
			binding: decipherBinding,
			kind: 'decipher',
			edits,
			seenCallRanges,
		});
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

function collectCallEdits({
	rootNode,
	statement,
	binding,
	kind,
	edits,
	seenCallRanges,
}: CollectParams) {
	if (!binding || binding === '') return;

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

		const replacement = buildDeCipherReplacement(
			{
				binding,
				algorithm,
				password,
				options: optionsText,
			},
			kind,
		);
		edits.push(call.replace(replacement));

		// Update the corresponding import/require binding if present.
		// Rename `createCipher`/`createDecipher` -> `createCipheriv`/`createDecipheriv`
		// and add helper bindings (`scryptSync`, and `randomBytes` for cipher).
		const sourceName = kind === 'cipher' ? 'createCipher' : 'createDecipher';
		const targetName = `${sourceName}iv`;

		const additions: string[] =
			kind === 'cipher' ? ['randomBytes', 'scryptSync'] : ['scryptSync'];

		// Preserve any local alias (e.g. `createCipher: makeCipher`) by
		// constructing a property:local string for the renamed binding.
		const local = findLocalSpecifierName(statement, sourceName);

		// Prefer an explicit update for destructured/named imports when
		// present so we can preserve aliasing and ordering exactly.
		const explicit = updateDestructuredStatement(
			statement,
			sourceName,
			targetName,
			local,
			additions,
		);

		if (explicit) {
			edits.push(explicit);
		}
	}
}

function buildDeCipherReplacement(
	{
		binding,
		algorithm,
		password,
		options,
	}: {
		binding: string;
		algorithm: string;
		password: string;
		options?: string;
	},
	kind: 'decipher' | 'cipher',
): string {
	const scryptCall = getMemberAccess(binding, 'scryptSync');
	const method = getCallableBinding(
		binding,
		kind === 'cipher' ? 'createCipheriv' : 'createDecipheriv',
	);

	if (kind === 'cipher') {
		const randomBytesCall = getMemberAccess(binding, 'randomBytes');
		return dedent(`
		(() => {
			const __dep0106Salt = ${randomBytesCall}(16);
			const __dep0106Key = ${scryptCall}(${password}, __dep0106Salt, 32);
			const __dep0106Iv = ${randomBytesCall}(16);
			// DEP0106: Persist __dep0106Salt and __dep0106Iv with the ciphertext so it can be decrypted later.
			// DEP0106: Adjust the derived key length (32 bytes) and IV length to match the chosen algorithm.
			return ${method}(${algorithm}, __dep0106Key, __dep0106Iv${options ? `, ${options}` : ''});
		})()
	`);
	}

	return dedent(`
	(() => {
		// DEP0106: Replace the placeholders below with the salt and IV that were stored with the ciphertext.
		const __dep0106Salt = /* TODO: stored salt Buffer */ Buffer.alloc(16);
		const __dep0106Iv = /* TODO: stored IV Buffer */ Buffer.alloc(16);
		const __dep0106Key = ${scryptCall}(${password}, __dep0106Salt, 32);
		// DEP0106: Ensure __dep0106Salt and __dep0106Iv match the values used during encryption.
		return ${method}(${algorithm}, __dep0106Key, __dep0106Iv${options ? `, ${options}` : ''});
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

function updateDestructuredStatement(
	statement: SgNode<Js>,
	oldName: string,
	targetName: string,
	localName: string | undefined,
	additions: string[],
): Edit | undefined {
	let namedImports = statement.find({ rule: { kind: 'named_imports' } });
	if (!namedImports) {
		const clause = statement.find({ rule: { kind: 'import_clause' } });
		if (clause) namedImports = clause.find({ rule: { kind: 'named_imports' } });
	}
	if (namedImports) {
		const isEsm = namedImports.parent()?.kind() === 'import_clause';

		// Work on textual specifiers to preserve formatting and order.
		const content = namedImports.text().replace(/^{\s*|\s*}$/g, '');
		const parts = content
			.split(',')
			.map((p) => p.trim())
			.filter(Boolean);
		const entries: string[] = parts.map((p) => {
			if (
				new RegExp(`^${escapeRegExp(oldName)}(\\b|\\s|:|\\s+as\\b)`).test(p)
			) {
				const local = localName ?? oldName;
				return isEsm ? `${targetName} as ${local}` : `${targetName}: ${local}`;
			}
			return p;
		});

		for (const a of additions) {
			if (!entries.some((e) => new RegExp(`\\b${escapeRegExp(a)}\\b`).test(e)))
				entries.push(a);
		}
		return namedImports.replace(`{ ${entries.join(', ')} }`);
	}

	const objectPattern = statement.find({ rule: { kind: 'object_pattern' } });
	if (objectPattern) {
		const pairs = objectPattern.findAll({
			rule: {
				any: [
					{ kind: 'pair_pattern' },
					{ kind: 'shorthand_property_identifier_pattern' },
				],
			},
		});
		if (pairs.length === 0) return undefined;

		const entries: string[] = [];
		for (const p of pairs) {
			if (p.kind() === 'pair_pattern') {
				const key = p.find({ rule: { kind: 'property_identifier' } });
				const value = p.children().find((c) => c.kind() === 'identifier');
				const prop = key.text();
				const local = value.text() ?? prop;

				const localToUse = localName ?? local;
				entries.push(`${targetName}: ${localToUse}`);
			} else {
				const text = p.text();

				if (text === oldName) {
					const local = text;
					const localToUse = localName ?? local;
					entries.push(`${targetName}: ${localToUse}`);
				}
			}
		}

		for (const a of additions) {
			if (!entries.some((e) => e.includes(a))) entries.push(a);
		}

		return objectPattern.replace(`{ ${entries.join(', ')} }`);
	}

	return undefined;
}

function escapeRegExp(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getRangeKey(node: SgNode<Js>): string {
	const range = node.range();
	return `${range.start.line}:${range.start.column}-${range.end.line}:${range.end.column}`;
}

function findLocalSpecifierName(
	statement: SgNode<Js>,
	propertyName: string,
): string | undefined {
	// pair_pattern: { prop: local }
	const pairs = statement.findAll({ rule: { kind: 'pair_pattern' } });
	for (const pair of pairs) {
		const key = pair.find({ rule: { kind: 'property_identifier' } });

		if (key && key.text() === propertyName) {
			const value = pair.children().find((c) => c.kind() === 'identifier');
			if (value) return value.text();
		}
	}

	// import_specifier: { name, alias }
	const specs = statement.findAll({ rule: { kind: 'import_specifier' } });
	for (const s of specs) {
		const nameNode = s.field?.('name');
		const aliasNode = s.field?.('alias');
		const idNode = s.find({ rule: { kind: 'identifier' } });
		const prop = nameNode?.text() || idNode?.text();

		if (prop && prop === propertyName) {
			if (aliasNode) return aliasNode.text();
			return prop;
		}
	}

	// shorthand destructure
	const sh = statement.find({
		rule: { kind: 'shorthand_property_identifier_pattern' },
	});
	if (sh && sh.text() === propertyName) return propertyName;

	return undefined;
}

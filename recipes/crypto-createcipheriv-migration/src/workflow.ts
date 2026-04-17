import { EOL } from 'node:os';
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
	seenCallIds: Set<number>;
};

/**
 * Transform deprecated crypto.createCipher()/createDecipher() usage to the
 * supported crypto.createCipheriv()/createDecipheriv() APIs.
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const seenCallIds = new Set<number>();

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
			seenCallIds,
		});

		const decipherBinding = resolveBindingPath(statement, '$.createDecipher');
		collectCallEdits({
			rootNode,
			statement,
			binding: decipherBinding,
			kind: 'decipher',
			edits,
			seenCallIds,
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
	seenCallIds,
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
		if (seenCallIds.has(call.id())) continue;
		seenCallIds.add(call.id());

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

		// Prefer an explicit update for destructured/named imports when
		// present so we can preserve aliasing and ordering exactly.
		const explicit = updateDestructuredStatement(
			statement,
			sourceName,
			targetName,
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
		return toNativeEOL(
			dedent(`
		(() => {
			const __dep0106Salt = ${randomBytesCall}(16);
			const __dep0106Key = ${scryptCall}(${password}, __dep0106Salt, 32);
			const __dep0106Iv = ${randomBytesCall}(16);
			// DEP0106: Persist __dep0106Salt and __dep0106Iv with the ciphertext so it can be decrypted later.
			// DEP0106: Adjust the derived key length (32 bytes) and IV length to match the chosen algorithm.
			return ${method}(${algorithm}, __dep0106Key, __dep0106Iv${options ? `, ${options}` : ''});
		})()
	`),
		);
	}

	return toNativeEOL(
		dedent(`
	(() => {
		// DEP0106: Replace the placeholders below with the salt and IV that were stored with the ciphertext.
		const __dep0106Salt = /* TODO: stored salt Buffer */ Buffer.alloc(16);
		const __dep0106Iv = /* TODO: stored IV Buffer */ Buffer.alloc(16);
		const __dep0106Key = ${scryptCall}(${password}, __dep0106Salt, 32);
		// DEP0106: Ensure __dep0106Salt and __dep0106Iv match the values used during encryption.
		return ${method}(${algorithm}, __dep0106Key, __dep0106Iv${options ? `, ${options}` : ''});
	})()
`),
	);
}

function toNativeEOL(text: string): string {
	return EOL === '\n' ? text : text.replaceAll('\n', EOL);
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
	additions: string[],
): Edit | undefined {
	const namedImports = statement.find({ rule: { kind: 'named_imports' } });
	if (namedImports) {
		const isEsm = namedImports.parent()?.kind() === 'import_clause';
		const specifiers = namedImports.findAll({ rule: { kind: 'import_specifier' } });
		const existingNames = new Set(
			specifiers.map((s) => s.field?.('name')?.text()).filter(Boolean),
		);
		const entries = specifiers.map((s) => {
			if (s.field?.('name')?.text() === oldName) {
				const local = s.field?.('alias')?.text() ?? oldName;
				return isEsm ? `${targetName} as ${local}` : `${targetName}: ${local}`;
			}
			return s.text();
		});

		for (const a of additions) {
			if (!existingNames.has(a)) entries.push(a);
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

		const existingNames = new Set<string>();
		const entries: string[] = [];
		for (const p of pairs) {
			if (p.kind() === 'pair_pattern') {
				const key = p.find({ rule: { kind: 'property_identifier' } });
				const propName = key.text();
				existingNames.add(propName);
				if (propName === oldName) {
					const local = p.children().find((c) => c.kind() === 'identifier')?.text() ?? propName;
					entries.push(`${targetName}: ${local}`);
				} else {
					entries.push(p.text());
				}
			} else {
				const text = p.text();
				existingNames.add(text);
				entries.push(text === oldName ? `${targetName}: ${text}` : text);
			}
		}

		for (const a of additions) {
			if (!existingNames.has(a)) entries.push(a);
		}

		return objectPattern.replace(`{ ${entries.join(', ')} }`);
	}

	return undefined;
}



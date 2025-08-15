import { getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import type { SgRoot, Edit, SgNode } from '@codemod.com/jssg-types/main';

// Escape regexp characters - "crypto.fips" -> "crypto\.fips"
const escapeRegExp = (input: string) =>
	input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Transform function that converts deprecated crypto.fips calls
 * to the new crypto.getFips() and crypto.setFips() syntax.
 *
 * Handles:
 * 1. crypto.fips -> crypto.getFips()
 * 2. crypto.fips = true -> crypto.setFips(true)
 * 3. crypto.fips = false -> crypto.setFips(false)
 */
export default function transform(root: SgRoot): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	const cryptoVars = collectCryptoFipsVariables(root);

	for (const [varName, info] of cryptoVars) {
		if (info.type === 'member' && info.base) {
			edits.push(...replaceMemberAssignments(rootNode, info.base));
			edits.push(...replaceMemberReads(rootNode, info.base));
		} else if (info.type === 'named') {
			edits.push(...replaceNamedAssignments(rootNode, varName));
			edits.push(...replaceNamedReads(rootNode, varName));
		}
	}

	edits.push(...updateCryptoImportSpecifiers(root));
	edits.push(...updateCryptoRequireDestructuring(root));

	if (edits.length === 0) return null;

	return rootNode.commitEdits(edits);
}

/**
 * Collect all crypto fips variables
 */
function collectCryptoFipsVariables(root: SgRoot) {
	const map = new Map<string, { type: 'member' | 'named'; base?: string }>();
	const importNodes = getNodeImportStatements(root, 'crypto');
	const requireNodes = getNodeRequireCalls(root, 'crypto');
	const allStatementNodes = [...importNodes, ...requireNodes];

	for (const { base, type } of getAllCryptoFipsBases(allStatementNodes)) {
		map.set(base, { type, base: type === 'member' ? base : undefined });
	}

	return map;
}

/**
 * Replace member access reads (crypto.fips)
 */
function replaceMemberReads(rootNode: SgNode, base: string) {
	const edits: Edit[] = [];
	const reads = rootNode.findAll({
		rule: { pattern: `${base}.fips` },
	});
	for (const read of reads) {
		edits.push(read.replace(`${base}.getFips()`));
	}
	return edits;
}

/**
 * Replace member assignments (crypto.fips = val)
 */
function replaceMemberAssignments(rootNode: SgNode, base: string) {
	const edits: Edit[] = [];
	const assignments = rootNode.findAll({
		rule: { pattern: `${base}.fips = $VALUE` },
	});
	for (const assign of assignments) {
		const valueText = assign.getMatch('VALUE')?.text() ?? '';
		const basePropRegex = new RegExp(`\\b${escapeRegExp(base)}\\.fips\\b`, 'g');
		const transformedValue = valueText.replace(
			basePropRegex,
			`${base}.getFips()`,
		);
		edits.push(assign.replace(`${base}.setFips(${transformedValue})`));
	}
	return edits;
}

/**
 * Update import specifiers to include getFips and setFips
 */
function updateCryptoImportSpecifiers(root: SgRoot): Edit[] {
	const edits: Edit[] = [];

	const importStmts = getNodeImportStatements(root, 'crypto');

	for (const stmt of importStmts) {
		// import_clause contains default/namespace/named parts
		const importClause = stmt.find({ rule: { kind: 'import_clause' } });
		if (!importClause) continue;

		// named_imports = `{ ... }`
		const namedImports = importClause.find({ rule: { kind: 'named_imports' } });
		if (!namedImports) continue; // nothing to edit if there is no `{ ... }`

		// All specifiers inside `{ ... }`
		const specifiers = namedImports.findAll({
			rule: { kind: 'import_specifier' },
		});
		if (!specifiers || specifiers.length === 0) continue;

		let hasFips = false;
		let hasGet = false;
		let hasSet = false;

		const keepTexts: string[] = [];

		for (const spec of specifiers) {
			// imported name is in field "name"
			const importedNameNode = spec.find({
				rule: { has: { field: 'name', kind: 'identifier' } },
			});
			const importedName = importedNameNode
				?.find({
					rule: { kind: 'identifier' },
				})
				?.text();

			if (importedName === 'fips') {
				hasFips = true; // drop this one; we will add getFips/setFips instead
				continue;
			}
			if (importedName === 'getFips') hasGet = true;
			if (importedName === 'setFips') hasSet = true;

			// Preserve other specifiers as-is (including aliases like `name as alias`)
			keepTexts.push(spec.text());
		}

		if (!hasFips) continue; // only rewrite when file was importing `fips`

		// Ensure both getFips and setFips are present
		if (!hasGet) keepTexts.push('getFips');
		if (!hasSet) keepTexts.push('setFips');

		// Replace the whole `{ ... }`
		edits.push(namedImports.replace(`{ ${keepTexts.join(', ')} }`));
	}

	return edits;
}

/**
 * Update require destructuring to include getFips and setFips
 */
function updateCryptoRequireDestructuring(root: SgRoot): Edit[] {
	const edits: Edit[] = [];

	const decls = getNodeRequireCalls(root, 'crypto');

	for (const decl of decls) {
		const objPattern = decl.find({ rule: { kind: 'object_pattern' } });
		if (!objPattern) continue;

		const props = objPattern.findAll({
			rule: {
				any: [
					{ kind: 'shorthand_property_identifier_pattern' }, // `{ foo }`
					{ kind: 'pair_pattern' }, // `{ foo: bar }`
				],
			},
		});
		if (!props || props.length === 0) continue;

		let hasFips = false;
		let hasGet = false;
		let hasSet = false;

		const keepTexts: string[] = [];

		for (const p of props) {
			if (p.kind() === 'shorthand_property_identifier_pattern') {
				const name = p.text().trim();
				if (name === 'fips') {
					hasFips = true;
					continue;
				}
				if (name === 'getFips') hasGet = true;
				if (name === 'setFips') hasSet = true;
				keepTexts.push(name);
			} else {
				// pair_pattern: has key + value (e.g. `fips: myFips`, `getFips: gf`)
				const keyNode = p.find({ rule: { kind: 'property_identifier' } });
				const key = keyNode?.text();

				if (key === 'fips') {
					hasFips = true; // drop any alias of fips
					continue;
				}
				if (key === 'getFips') hasGet = true;
				if (key === 'setFips') hasSet = true;

				// Keep other pairs as-is (preserves aliasing/spacing nicely)
				keepTexts.push(p.text().trim());
			}
		}

		if (!hasFips) continue; // only rewrite when it actually destructured `fips`

		if (!hasGet) keepTexts.push('getFips');
		if (!hasSet) keepTexts.push('setFips');

		edits.push(objPattern.replace(`{ ${keepTexts.join(', ')} }`));
	}

	return edits;
}

/**
 * Replace named reads (fips -> getFips())
 */
function replaceNamedReads(rootNode: SgNode, varName: string) {
	const edits: Edit[] = [];
	const reads = rootNode.findAll({
		rule: { pattern: varName },
	});
	for (const read of reads) {
		edits.push(read.replace('getFips()'));
	}
	return edits;
}

/**
 * Replace named assignments (fips = val -> setFips(val))
 */
function replaceNamedAssignments(rootNode: SgNode, varName: string) {
	const edits: Edit[] = [];
	const assignments = rootNode.findAll({
		rule: { pattern: `${varName} = $VALUE` },
	});
	for (const assign of assignments) {
		const valueText = assign.getMatch('VALUE')?.text() ?? '';
		edits.push(assign.replace(`setFips(${valueText})`));
	}
	return edits;
}

/**
 * Get the base of the crypto fips variable
 * import { fips } from "node:crypto" -> "fips"
 * import crypto from "node:crypto" -> "crypto"
 * const { fips } = require("node:crypto") -> "fips"
 * const crypto = require("node:crypto") -> "crypto"
 */
function* getCryptoFipsBase(statements: SgNode[], type: 'member' | 'named') {
	for (const stmt of statements) {
		const resolvedPath = resolveBindingPath(stmt, '$.fips');
		if (resolvedPath?.includes('.') && type === 'member') {
			const base = resolvedPath.slice(0, resolvedPath.lastIndexOf('.'));
			yield { base, type };
		} else if (resolvedPath && type === 'named') {
			yield { base: resolvedPath, type };
		}
	}
}

/**
 * Get crypto bases/names for both member and named imports
 */
function* getAllCryptoFipsBases(statements: SgNode[]) {
	yield* getCryptoFipsBase(statements, 'member');
	yield* getCryptoFipsBase(statements, 'named');
}

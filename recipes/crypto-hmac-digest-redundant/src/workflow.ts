import type { Range, SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import { getScope } from '@nodejs/codemod-utils/ast-grep/get-scope';

const BRANCH_KINDS = [
	'if_statement',
	'for_statement',
	'for_in_statement',
	'while_statement',
	'do_statement',
	'switch_statement',
	'try_statement',
] as const;

/**
 * Transforms code by removing provably redundant argument-free Hmac.digest() calls
 * on already-finalized Hmac instances (DEP0206).
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const cryptoDeps = getModuleDependencies(root, 'crypto');
	if (cryptoDeps.length === 0) return null;

	const createHmacCallees = new Set<string>();
	for (const dep of cryptoDeps) {
		const resolved = resolveBindingPath(dep, '$.createHmac');
		if (resolved) {
			createHmacCallees.add(resolved);
		}
	}

	if (createHmacCallees.size === 0) return null;

	const linesToRemove: Range[] = [];
	const declarators = rootNode.findAll({
		rule: { kind: 'variable_declarator' },
	});

	for (const decl of declarators) {
		const nameNode = decl.field('name');
		const valueNode = decl.field('value');

		if (
			nameNode?.kind() !== 'identifier' ||
			valueNode?.kind() !== 'call_expression'
		) {
			continue;
		}

		const fnNode = valueNode.field('function');
		if (!fnNode || !createHmacCallees.has(fnNode.text())) {
			continue;
		}

		const hmacName = nameNode.text();
		const scopeNode = getScope(decl);
		if (!scopeNode) continue;

		if (!isSafeHmac(decl, hmacName, scopeNode)) {
			continue;
		}

		const redundantStmts = findRedundantCalls(scopeNode, decl, hmacName);
		for (const stmt of redundantStmts) {
			linesToRemove.push(stmt.range());
		}
	}

	if (linesToRemove.length === 0) return null;

	return removeLines(rootNode.text(), linesToRemove);
}

function isSafeHmac(
	declNode: SgNode<Js>,
	hmacName: string,
	scopeNode: SgNode<Js>,
): boolean {
	// 1. Check for reassignments to hmacName or property mutations on hmacName
	const assignments = scopeNode.findAll({
		rule: { kind: 'assignment_expression' },
	});

	for (const assign of assignments) {
		const left = assign.field('left');
		if (left?.kind() === 'identifier' && left.text() === hmacName) {
			return false;
		}
		if (
			left?.kind() === 'member_expression' &&
			left.field('object')?.text() === hmacName
		) {
			return false;
		}
	}

	// 2. Check for update expressions (e.g. hmac++)
	const updates = scopeNode.findAll({ rule: { kind: 'update_expression' } });
	for (const update of updates) {
		if (update.field('argument')?.text() === hmacName) {
			return false;
		}
	}

	// 3. Check all identifier occurrences to verify hmac does not escape
	const identifiers = scopeNode.findAll({
		rule: {
			kind: 'identifier',
			pattern: hmacName,
		},
	});

	const declNameId = declNode.field('name')?.id();

	for (const id of identifiers) {
		if (id.id() === declNameId) continue;

		const parent = id.parent();
		if (
			parent?.kind() === 'member_expression' &&
			parent.field('object')?.id() === id.id()
		) {
			const prop = parent.field('property')?.text();
			if (prop !== 'update' && prop !== 'digest') {
				return false;
			}

			const grandParent = parent.parent();
			if (
				grandParent?.kind() === 'call_expression' &&
				grandParent.field('function')?.id() === parent.id()
			) {
				continue;
			}

			return false;
		}

		return false;
	}

	return true;
}

function findRedundantCalls(
	scopeNode: SgNode<Js>,
	declNode: SgNode<Js>,
	hmacName: string,
): SgNode<Js>[] {
	const declLine = declNode.range().start.line;
	const statements = scopeNode.children().filter((c) => {
		const k = c.kind();
		return k.endsWith('_statement') || k.endsWith('_declaration');
	});

	let finalized = false;
	const redundant: SgNode<Js>[] = [];

	for (const stmt of statements) {
		if (stmt.range().start.line <= declLine) continue;

		const hasBranch =
			BRANCH_KINDS.some((k) => k === stmt.kind()) ||
			stmt.find({
				rule: {
					any: BRANCH_KINDS.map((k) => ({ kind: k })),
				},
			});

		if (hasBranch) {
			const referencesHmac = stmt.find({
				rule: { kind: 'identifier', pattern: hmacName },
			});
			if (referencesHmac) {
				return [];
			}
		}

		const digestCalls = stmt.findAll({
			rule: {
				pattern: `${hmacName}.digest($$$ARGS)`,
			},
		});

		if (digestCalls.length === 0) continue;

		for (const call of digestCalls) {
			if (!finalized) {
				finalized = true;
			} else {
				const isStandaloneExpr = stmt.kind() === 'expression_statement';
				const args = call.field('arguments');
				const isArgFree =
					args?.children().length === 2 || args?.text().trim() === '()';

				if (isStandaloneExpr && isArgFree) {
					redundant.push(stmt);
				}
			}
		}
	}

	return redundant;
}

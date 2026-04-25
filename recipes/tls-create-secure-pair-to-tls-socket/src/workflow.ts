import type { SgRoot, SgNode, Edit } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { updateBinding } from '@nodejs/codemod-utils/ast-grep/update-binding';

export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const tlsStmts = getModuleDependencies(root, 'tls');

	if (!tlsStmts.length) return null;

	const cspBindings = [];

	for (const stmt of tlsStmts) {
		const binding = resolveBindingPath(stmt, '$.createSecurePair');
		if (binding) cspBindings.push(binding);
	}

	if (!cspBindings.length) return null;

	const edits: Edit[] = [];

	// Transform all createSecurePair calls
	const calls = rootNode.findAll({ rule: { kind: 'call_expression' } });

	for (const call of calls) {
		const callee = call.field('function');
		if (!callee) continue;

		const binding = getCallBinding(callee);
		if (!binding || !cspBindings.includes(binding)) continue;

		// Extract arguments
		const args = call.field('arguments');
		if (!args) continue;

		const argNodes = args
			.children()
			.filter((n) => n.isNamed() && !n.is('comment'));

		const options = buildOptions(
			argNodes[0]?.text() || null,
			argNodes[1]?.text() || null,
			argNodes[2]?.text() || null,
			argNodes[3]?.text() || null,
		);

		const replacement = binding.includes('.')
			? `new ${binding.replace(/\.createSecurePair$/, '.TLSSocket')}(underlyingSocket, ${options})`
			: `new TLSSocket(underlyingSocket, ${options})`;

		edits.push(call.replace(replacement));
	}

	// Rename variables named 'pair' to 'socket'
	edits.push(...renamePairVariables(rootNode, cspBindings));

	// Update imports
	const importStmts = tlsStmts.filter(
		(s) => s.is('import_statement') || s.is('variable_declarator'),
	);

	for (const importStmt of importStmts) {
		const result = updateBinding(importStmt, {
			old: 'createSecurePair',
			new: 'TLSSocket',
			removeAlias: true,
		});

		if (result?.edit) {
			edits.push(result.edit);
		}
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

function getCallBinding(callee: SgNode<JS>): string | null {
	if (callee.is('member_expression')) {
		const obj = callee.field('object');
		const prop = callee.field('property');
		if (!obj || !prop) return null;
		return `${obj.text()}.${prop.text()}`;
	}
	if (callee.is('identifier')) {
		return callee.text();
	}
	return null;
}

function buildOptions(
	secureContext?: string | null,
	isServer?: string | null,
	requestCert?: string | null,
	rejectUnauthorized?: string | null,
) {
	const kv: string[] = [];
	if (secureContext) kv.push(`secureContext: ${secureContext}`);
	if (isServer) kv.push(`isServer: ${isServer}`);
	if (requestCert) kv.push(`requestCert: ${requestCert}`);
	if (rejectUnauthorized) kv.push(`rejectUnauthorized: ${rejectUnauthorized}`);
	return kv.length > 0 ? `{ ${kv.join(', ')} }` : '{}';
}

function renamePairVariables(rootNode: SgNode<JS>, bindings: string[]): Edit[] {
	const edits: Edit[] = [];

	const decls = rootNode.findAll({
		rule: {
			kind: 'variable_declarator',
			all: [
				{ has: { field: 'name', pattern: 'pair' } },
				{ has: { field: 'value', kind: 'call_expression' } },
			],
		},
	});

	for (const decl of decls) {
		const callExpr = decl.field('value');
		if (!callExpr) continue;

		const callee = callExpr.field('function');
		if (!callee) continue;

		const binding = getCallBinding(callee);
		if (!binding || !bindings.includes(binding)) continue;

		const name = decl.field('name');
		if (name.is('identifier')) {
			edits.push(name.replace('socket'));
		}
	}

	return edits;
}

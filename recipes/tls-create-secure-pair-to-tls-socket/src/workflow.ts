import type { SgNode, Edit, Codemod } from 'codemod:ast-grep';
import type JS from '@codemod.com/jssg-types/langs/tsx';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';
import { updateBinding } from '@nodejs/codemod-utils/ast-grep/update-binding';
import {
	getAllImports,
	addImport,
	removeImport,
} from '@jssg/utils/javascript/imports';

type GetImportOptions = {
	from: string[];
	name: string;
};

type ImportNode = ReturnType<typeof getAllImports<JS>>[number];

function getImports(
	rootNode: SgNode<JS, 'program'>,
	options: GetImportOptions,
): {
	default: ImportNode[];
	named: ImportNode[];
} {
	let defaultImports: ImportNode[] = [];
	let namedImports: ImportNode[] = [];
	for (const from of options.from) {
		const _defaultImports = getAllImports(rootNode, {
			from: from,
			type: 'default',
		});

		const _namedImports = getAllImports(rootNode, {
			from: from,
			type: 'named',
			name: options.name,
		});

		defaultImports = defaultImports.concat(_defaultImports);
		namedImports = namedImports.concat(_namedImports);
	}

	return {
		default: defaultImports,
		named: namedImports,
	};
}

const transform: Codemod<JS> = async (root) => {
	const rootNode = root.root();
	const tlsStmts = getModuleDependencies(root, 'tls');
	const imp = getImports(rootNode, {
		name: 'createSecurePair',
		from: ['tls', 'node:tls'],
	});

	const calls = [];
	const edits: Edit[] = [];

	for (const importNode of imp.named) {
		const removeEdit = removeImport(rootNode, {
			type: 'named',
			from: 'node:tls',
			specifiers: [importNode.node.text()],
		});
		if (removeEdit) edits.push(removeEdit);

		const addEdit = addImport(rootNode, {
			specifiers: [{ name: 'TLSSocket' }],
			from: 'node:tls',
			type: 'named',
			moduleType: importNode.moduleType,
		});

		if (addEdit) edits.push(addEdit);

		const fileReferences = importNode.node.references()[0];
		for (const ref of fileReferences.nodes) {
			const node = ref.find({
				rule: {
					inside: {
						kind: 'call_expression',
						stopBy: 'end',
					},
				},
			});

			if (node) calls.push(node);
		}
	}

	for (const importNode of imp.default) {
		const fileReferences = importNode.node.references()[0];
		for (const ref of fileReferences.nodes) {
			const node = ref.find({
				rule: {
					inside: {
						kind: 'call_expression',
						stopBy: 'end',
						has: {
							field: 'function',
							kind: 'member_expression',
							has: {
								field: 'property',
								regex: '^createSecurePair$',
							},
						},
					},
				},
			});

			if (node) calls.push(node);
		}
	}

	if (!tlsStmts.length) return null;

	const cspBindings = [];

	for (const stmt of tlsStmts) {
		const binding = resolveBindingPath(stmt, '$.createSecurePair');
		if (binding) cspBindings.push(binding);
	}

	if (!cspBindings.length) return null;

	// Transform all createSecurePair calls
	// const calls = rootNode.findAll({ rule: { kind: 'call_expression' } });

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

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
};

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

export default transform;

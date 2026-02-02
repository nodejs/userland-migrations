import type { SgRoot, SgNode, Edit } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';

export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const tlsStmts = getModuleDependencies(root, 'tls');

	if (!tlsStmts.length) return null;

	const cspBindings = collectAllBindings(tlsStmts);

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
			.filter((n) => n.kind() !== '(' && n.kind() !== ')' && n.kind() !== ',');

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
	edits.push(
		...rewriteTlsImports(
			tlsStmts.filter(
				(s) => s.is('import_statement') || s.is('variable_declarator'),
			),
		),
	);

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

function unique<T>(arr: T[]): T[] {
	return Array.from(new Set(arr));
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

function rewriteTlsImports(nodeImportStatements: SgNode<JS>[]): Edit[] {
	const edits: Edit[] = [];

	for (const stmt of nodeImportStatements) {
		if (stmt.is('import_statement')) {
			const edit = rewriteEsmImport(stmt);
			if (edit) edits.push(edit);
		} else if (stmt.is('variable_declarator')) {
			const edit = rewriteCjsRequire(stmt);
			if (edit) edits.push(edit);
		}
	}

	return edits;
}

function rewriteEsmImport(stmt: SgNode<JS>): Edit | null {
	const named = stmt.find({ rule: { kind: 'named_imports' } });
	const namespace = stmt.find({ rule: { kind: 'namespace_import' } });
	if (!named || namespace) return null;

	const srcText = stmt.field('source')?.text()?.replace(/['"]/g, '') || '';
	if (srcText !== 'tls' && srcText !== 'node:tls') return null;

	const specs = named.findAll({ rule: { kind: 'import_specifier' } });
	if (!specs.some((s) => s.field('name')?.text() === 'createSecurePair'))
		return null;

	const kept = specs
		.filter((s) => s.field('name')?.text() !== 'createSecurePair')
		.map((s) => {
			const imported = s.field('name')?.text();
			const alias = s.field('alias')?.text();
			return alias ? `${imported} as ${alias}` : imported;
		});

	if (!kept.includes('TLSSocket')) kept.push('TLSSocket');

	const defaultImport = stmt
		.find({
			rule: {
				kind: 'import_clause',
				has: { field: 'name', kind: 'identifier' },
			},
		})
		?.field('name')
		?.text();

	const rebuilt = defaultImport
		? `import ${defaultImport}, { ${kept.join(', ')} } from '${srcText}';`
		: `import { ${kept.join(', ')} } from '${srcText}';`;

	return stmt.replace(rebuilt);
}

function rewriteCjsRequire(stmt: SgNode<JS>): Edit | null {
	const name = stmt.field('name');
	if (!name || !name.is('object_pattern')) return null;

	const props = name.findAll({
		rule: {
			any: [
				{ kind: 'pair_pattern' },
				{ kind: 'shorthand_property_identifier_pattern' },
			],
		},
	});

	const hasCSP = props.some((p) =>
		p.is('pair_pattern')
			? p.field('key')?.text() === 'createSecurePair' ||
				p.field('value')?.text() === 'createSecurePair'
			: p.text() === 'createSecurePair',
	);
	if (!hasCSP) return null;

	const kept = props
		.filter((p) => {
			const key = p.is('pair_pattern') ? p.field('key')?.text() : p.text();
			return key !== 'createSecurePair';
		})
		.map((p) => {
			if (p.is('pair_pattern')) {
				const key = p.field('key')?.text();
				const val = p.field('value')?.text();
				return val && val !== key ? `${key}: ${val}` : key;
			}
			return p.text();
		});

	if (!kept.includes('TLSSocket')) kept.push('TLSSocket');

	let decl: SgNode<JS> = stmt;
	let cur = stmt.parent?.();
	while (cur) {
		if (cur.is('lexical_declaration') || cur.is('variable_declaration')) {
			decl = cur;
			break;
		}
		cur = cur.parent?.();
	}

	return decl.replace(`const { ${kept.join(', ')} } = require('node:tls');`);
}

function collectAllBindings(tlsStmts: SgNode<JS>[]): string[] {
	const bindings: string[] = [];

	for (const stmt of tlsStmts) {
		const kind = stmt.kind();

		// Use resolveBindingPath for standard imports/requires
		if (
			kind === 'lexical_declaration' ||
			kind === 'variable_declarator' ||
			kind === 'import_statement' ||
			kind === 'import_clause'
		) {
			const resolved = resolveBindingPath(
				stmt as unknown as SgNode<JS>,
				'$.createSecurePair',
			);
			if (resolved) bindings.push(resolved);
		}

		// Handle ESM aliases: import { createSecurePair as csp } from 'tls'
		if (kind === 'import_statement') {
			const alias = getEsmAlias(stmt);
			if (alias) bindings.push(alias);
		}

		// Handle CJS destructured aliases: const { createSecurePair: csp } = require('tls')
		if (kind === 'variable_declarator') {
			const cjsAlias = getCjsAlias(stmt);
			if (cjsAlias) bindings.push(cjsAlias);

			// Handle dynamic imports: const tls = await import('tls')
			const awaitBinding = getAwaitImportBinding(stmt);
			if (awaitBinding) bindings.push(awaitBinding);
		}

		// Handle dynamic import .then(): import('tls').then(tls => ...)
		if (kind === 'expression_statement') {
			const thenBinding = getThenImportBinding(stmt);
			if (thenBinding) bindings.push(thenBinding);
		}
	}

	return unique(bindings);
}

function getEsmAlias(stmt: SgNode<JS>): string | null {
	const specs = stmt.findAll({
		rule: {
			kind: 'import_specifier',
			has: { field: 'alias', kind: 'identifier' },
		},
	});

	for (const spec of specs) {
		if (spec.field('name')?.text() === 'createSecurePair') {
			return spec.field('alias')?.text() || null;
		}
	}
	return null;
}

function getCjsAlias(stmt: SgNode<JS>): string | null {
	const objPattern = stmt.field('name');
	if (objPattern?.kind() !== 'object_pattern') return null;

	const pairs = objPattern.findAll({ rule: { kind: 'pair_pattern' } });
	for (const pair of pairs) {
		if (pair.field('key')?.text() === 'createSecurePair') {
			const alias = pair.field('value')?.text();
			if (alias && alias !== 'createSecurePair') {
				return alias;
			}
		}
	}
	return null;
}

function getAwaitImportBinding(stmt: SgNode<JS>): string | null {
	const value = stmt.field('value');
	if (value?.kind() !== 'await_expression') return null;

	const name = stmt.field('name');
	if (name.is('identifier')) {
		return `${name.text()}.createSecurePair`;
	}
	return null;
}

function getThenImportBinding(stmt: SgNode<JS>): string | null {
	const expr = stmt.children().find((c) => c.is('call_expression'));
	if (!expr || !expr.is('call_expression')) return null;

	const func = expr.field('function');
	if (func?.kind() !== 'member_expression') return null;

	const prop = func.field('property');
	if (prop?.text() !== 'then') return null;

	const args = expr.field('arguments');
	const callback = args?.find({
		rule: {
			any: [{ kind: 'arrow_function' }, { kind: 'function_expression' }],
		},
	});

	if (!callback) return null;

	let param: SgNode<JS> | undefined;
	if (callback.is('arrow_function')) {
		param =
			callback.field('parameter') ||
			callback.field('parameters')?.find({ rule: { kind: 'identifier' } });
	} else if (callback.is('function_expression')) {
		param = callback
			.field('parameters')
			?.find({ rule: { kind: 'identifier' } });
	}

	return param ? `${param.text()}.createSecurePair` : null;
}

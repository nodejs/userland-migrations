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
	edits.push(...rewriteTlsImports(tlsStmts));

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

function getCallBinding(callee: SgNode<JS>): string | null {
	if (callee.kind() === 'member_expression') {
		const obj = callee.field('object');
		const prop = callee.field('property');
		if (!obj || !prop) return null;
		return `${obj.text()}.${prop.text()}`;
	}
	if (callee.kind() === 'identifier') {
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
		if (name && name.kind() === 'identifier') {
			edits.push(name.replace('socket'));
		}
	}

	return edits;
}

function rewriteTlsImports(
	nodeImportStatements: Array<SgNode<JS>> = [],
): Edit[] {
	const edits: Edit[] = [];

	// Handle ESM named imports
	const esmNamed = nodeImportStatements
		.map((stmt) => stmt)
		.filter((stmt) => {
			const named = stmt.find({ rule: { kind: 'named_imports' } });
			const namespace = stmt.find({ rule: { kind: 'namespace_import' } });
			return named && !namespace;
		});

	for (const decl of esmNamed) {
		const srcText = decl.field('source')?.text()?.replace(/['"]/g, '') || '';
		if (srcText !== 'tls' && srcText !== 'node:tls') continue;

		const named = decl.find({ rule: { kind: 'named_imports' } });
		if (!named) continue;

		const specs = named.findAll({ rule: { kind: 'import_specifier' } });
		const hasCSP = specs.some(
			(s) => s.field('name')?.text() === 'createSecurePair',
		);
		if (!hasCSP) continue;

		const kept: string[] = [];
		for (const s of specs) {
			const imported = s.field('name')?.text();
			const maybeAlias = s.field('alias')?.text();
			if (imported && imported !== 'createSecurePair') {
				kept.push(maybeAlias ? `${imported} as ${maybeAlias}` : imported);
			}
		}

		if (kept.indexOf('TLSSocket') === -1) kept.push('TLSSocket');

		const def = decl
			.find({
				rule: {
					kind: 'import_clause',
					has: { field: 'name', kind: 'identifier' },
				},
			})
			?.field('name')
			?.text();

		const rebuilt = def
			? `import ${def}, { ${kept.join(', ')} } from '${srcText}';`
			: `import { ${kept.join(', ')} } from '${srcText}';`;

		edits.push(decl.replace(rebuilt));
	}

	// Handle CJS destructured requires
	const cjsNamed = nodeImportStatements.filter((stmt) => {
		if (stmt.kind() !== 'variable_declarator') return false;

		const name = stmt.field('name');
		const value = stmt.field('value');
		if (!name || name.kind() !== 'object_pattern' || !value) return false;

		return true;
	});

	for (const decl of cjsNamed) {
		const obj = decl.field('name');
		if (!obj) continue;

		const props = obj.findAll({
			rule: {
				any: [
					{ kind: 'pair_pattern' },
					{ kind: 'shorthand_property_identifier_pattern' },
				],
			},
		});

		const hasCSP = props.some((p) =>
			p.kind() === 'pair_pattern'
				? p.field('key')?.text() === 'createSecurePair' ||
					p.field('value')?.text() === 'createSecurePair'
				: p.text() === 'createSecurePair',
		);

		if (!hasCSP) continue;

		const kept: string[] = [];
		for (const p of props) {
			let name = '';
			let alias = '';
			if (p.kind() === 'pair_pattern') {
				name = p.field('key')?.text() || '';
				alias = p.field('value')?.text() || '';
			} else {
				name = p.text();
				alias = name;
			}
			if (!name || name === 'createSecurePair') continue;
			kept.push(alias && alias !== name ? `${name}: ${alias}` : name);
		}

		if (kept.indexOf('TLSSocket') === -1) kept.push('TLSSocket');

		let stmt: SgNode<JS> = decl;
		let cur: SgNode<JS> | undefined = decl;

		while (cur) {
			const k = cur.kind();
			if (k === 'lexical_declaration' || k === 'variable_declaration') {
				stmt = cur;
				break;
			}
			cur = cur.parent?.();
		}

		edits.push(
			stmt.replace(`const { ${kept.join(', ')} } = require('node:tls');`),
		);
	}

	return edits;
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
			const specs = stmt.findAll({
				rule: {
					kind: 'import_specifier',
					has: { field: 'alias', kind: 'identifier' },
				},
			});

			for (const spec of specs) {
				if (spec.field('name')?.text() === 'createSecurePair') {
					const alias = spec.field('alias')?.text();
					if (alias) bindings.push(alias);
				}
			}
		}

		// Handle CJS destructured aliases: const { createSecurePair: csp } = require('tls')
		if (kind === 'variable_declarator') {
			const objPattern = stmt.field('name');
			if (objPattern?.kind() === 'object_pattern') {
				const pairs = objPattern.findAll({ rule: { kind: 'pair_pattern' } });
				for (const pair of pairs) {
					if (pair.field('key')?.text() === 'createSecurePair') {
						const alias = pair.field('value')?.text();
						if (alias && alias !== 'createSecurePair') {
							bindings.push(alias);
						}
					}
				}
			}

			// Handle dynamic imports: const tls = await import('tls')
			const value = stmt.field('value');
			if (value?.kind() === 'await_expression') {
				const name = stmt.field('name');
				if (name?.kind() === 'identifier') {
					bindings.push(`${name.text()}.createSecurePair`);
				}
			}
		}

		// Handle dynamic import .then(): import('tls').then(tls => ...)
		// getModuleDependencies returns the expression_statement node
		if (kind === 'expression_statement') {
			const expr = stmt.children().find((c) => c.kind() === 'call_expression');
			if (expr?.kind() === 'call_expression') {
				const func = expr.field('function');
				if (func?.kind() === 'member_expression') {
					const prop = func.field('property');
					if (prop?.text() === 'then') {
						const args = expr.field('arguments');
						const callback = args?.find({
							rule: {
								any: [
									{ kind: 'arrow_function' },
									{ kind: 'function_expression' },
								],
							},
						});

						if (callback) {
							let param: SgNode<JS> | undefined;

							if (callback.kind() === 'arrow_function') {
								param = callback.field('parameter');
								if (!param) {
									const params = callback.field('parameters');
									param = params?.find({ rule: { kind: 'identifier' } });
								}
							} else if (callback.kind() === 'function_expression') {
								const params = callback.field('parameters');
								param = params?.find({ rule: { kind: 'identifier' } });
							}

							if (param) {
								bindings.push(`${param.text()}.createSecurePair`);
							}
						}
					}
				}
			}
		}
	}

	return unique(bindings);
}

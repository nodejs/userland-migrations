import type { SgRoot, SgNode, Edit } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';

type CallSite = { call: SgNode<JS>; binding: string };

export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const tlsStmts = getModuleDependencies(root, 'tls');
	const cspBindings = unique([
		...(tlsStmts
			.filter((s) => {
				const kind = s.kind();
				return (
					kind === 'lexical_declaration' ||
					kind === 'variable_declarator' ||
					kind === 'import_statement' ||
					kind === 'import_clause'
				);
			})
			.map((s) =>
				resolveBindingPath(s as unknown as SgNode<JS>, '$.createSecurePair'),
			)
			.filter(Boolean) as string[]),
		...collectNamedImportAliases(tlsStmts, 'createSecurePair'),
		...collectCjsAliases(rootNode),
		...collectDefaultImportBindings(tlsStmts),
		...collectDynamicImportIdentifiers(rootNode),
		...collectDynamicImportThenBindings(rootNode),
	]);
	const callSites: CallSite[] = findCallsMatchingBindings(
		rootNode,
		cspBindings,
	);
	const edits: Edit[] = [];

	for (const { call, binding } of callSites) {
		// Get arguments
		const args = call.field('arguments');
		if (!args) continue;

		// Extract up to 4 arguments
		const argNodes = args
			.children()
			.filter((n) => n.kind() !== '(' && n.kind() !== ')' && n.kind() !== ',');
		const a = argNodes[0] ? getText(argNodes[0]) : null;
		const b = argNodes[1] ? getText(argNodes[1]) : null;
		const c = argNodes[2] ? getText(argNodes[2]) : null;
		const d = argNodes[3] ? getText(argNodes[3]) : null;

		const options = buildOptions(a, b, c, d);
		const isNamespace = binding.includes('.');
		const replacement = isNamespace
			? `new ${binding.replace(/\.createSecurePair$/, '.TLSSocket')}(underlyingSocket, ${options})`
			: `new TLSSocket(underlyingSocket, ${options})`;
		edits.push(call.replace(replacement));
	}
	edits.push(...renamePairAssignedVariables(rootNode, cspBindings));

	edits.push(...rewriteTlsImports(rootNode));

	if (edits.length === 0) return null;

	return rootNode.commitEdits(edits);
}

function findCallsMatchingBindings(
	rootNode: SgNode<JS>,
	bindings: string[],
): CallSite[] {
	const out: CallSite[] = [];

	// Find all call expressions
	const calls = rootNode.findAll({
		rule: { kind: 'call_expression' },
	});

	for (const call of calls) {
		const callee = call.field('function');
		if (!callee) continue;

		let binding: string;
		if (callee.kind() === 'member_expression') {
			// tls.createSecurePair or similar
			const obj = callee.field('object');
			const prop = callee.field('property');
			if (!obj || !prop) continue;
			binding = `${obj.text()}.${prop.text()}`;
		} else if (callee.kind() === 'identifier') {
			// createSecurePair or csp (alias)
			binding = callee.text();
		} else {
			continue;
		}

		// Only include calls that match our bindings
		if (bindings.includes(binding)) {
			out.push({ call, binding });
		}
	}

	return out;
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
	return `{ ${kv.join(', ')} }`;
}

function getText(node: SgNode<JS> | undefined): string | null {
	return node?.text()?.trim() || null;
}

function unique<T>(arr: T[]): T[] {
	return Array.from(new Set(arr));
}

function renamePairAssignedVariables(
	rootNode: SgNode<JS>,
	bindings: string[],
): Edit[] {
	const edits: Edit[] = [];
	const decls = rootNode.findAll({
		rule: {
			kind: 'variable_declarator',
			all: [
				{ has: { field: 'name', kind: 'identifier' } },
				{ has: { field: 'value', kind: 'call_expression' } },
			],
		},
	});

	for (const decl of decls) {
		const callExpr = decl.field('value');
		if (!callExpr) continue;

		// Check if this call is from the tls module
		const callee = callExpr.field('function');
		if (!callee) continue;

		let binding: string;
		if (callee.kind() === 'member_expression') {
			// tls.createSecurePair or similar
			const obj = callee.field('object');
			const prop = callee.field('property');
			if (!obj || !prop) continue;
			binding = `${obj.text()}.${prop.text()}`;
		} else if (callee.kind() === 'identifier') {
			// createSecurePair or csp (alias)
			binding = callee.text();
		} else {
			continue;
		}

		// Only rename if it's from the tls module
		if (!bindings.includes(binding)) continue;

		const name = decl.field('name');
		if (name && name.kind() === 'identifier' && name.text() === 'pair') {
			edits.push(name.replace('socket'));
		}
	}

	return edits;
}

function rewriteTlsImports(rootNode: SgNode<JS>): Edit[] {
	const edits: Edit[] = [];
	const esmNamed = rootNode.findAll({
		rule: {
			kind: 'import_statement',
			all: [
				{ has: { kind: 'import_clause', has: { kind: 'named_imports' } } },
				{
					has: {
						field: 'source',
						any: [
							{ pattern: "'tls'" },
							{ pattern: '"tls"' },
							{ pattern: "'node:tls'" },
							{ pattern: '"node:tls"' },
						],
					},
				},
			],
			not: { has: { kind: 'namespace_import' } },
		},
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
	const cjsNamed = rootNode.findAll({
		rule: {
			kind: 'variable_declarator',
			all: [
				{ has: { field: 'name', kind: 'object_pattern' } },
				{
					has: {
						field: 'value',
						any: [
							{ pattern: "require('tls')" },
							{ pattern: 'require("tls")' },
							{ pattern: "require('node:tls')" },
							{ pattern: 'require("node:tls")' },
						],
					},
				},
			],
		},
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

function collectDefaultImportBindings(tlsStmts: SgNode<JS>[]): string[] {
	const out: string[] = [];

	for (const stmt of tlsStmts) {
		if (stmt.kind() !== 'import_declaration') continue;
		const src = stmt.field('source')?.text()?.replace(/['"]/g, '');
		if (!/^(node:)?tls$/.test(src || '')) continue;
		const def = stmt
			.find({
				rule: {
					kind: 'import_clause',
					has: { field: 'name', kind: 'identifier' },
				},
			})
			?.field('name')
			?.text();
		if (def) out.push(`${def}.createSecurePair`);
	}

	return out;
}

function collectDynamicImportIdentifiers(rootNode: SgNode<JS>): string[] {
	const out: string[] = [];
	const pats = [
		"const $ID = await import('tls')",
		'const $ID = await import("tls")',
		"const $ID = await import('node:tls')",
		'const $ID = await import("node:tls")',
		"const $ID = import('tls')",
		'const $ID = import("tls")',
		"const $ID = import('node:tls')",
		'const $ID = import("node:tls")',
	];

	for (const p of pats) {
		const nodes = rootNode.findAll({ rule: { pattern: p } });
		for (const n of nodes) {
			const id = n.getMatch('ID')?.text();
			if (id) out.push(`${id}.createSecurePair`);
		}
	}

	return unique(out);
}

function collectDynamicImportThenBindings(rootNode: SgNode<JS>): string[] {
	const out: string[] = [];

	// Use simpler patterns that are known to work
	const patterns = [
		"import('tls').then($CB)",
		'import("tls").then($CB)',
		"import('node:tls').then($CB)",
		'import("node:tls").then($CB)',
	];

	for (const pattern of patterns) {
		const calls = rootNode.findAll({ rule: { pattern } });

		for (const call of calls) {
			const callback = call.getMatch('CB');
			if (!callback) continue;

			let paramName: string | undefined;

			if (callback.kind() === 'arrow_function') {
				// Arrow function: tls => ...
				const param = callback.field('parameter');
				if (param && param.kind() === 'identifier') {
					paramName = param.text();
				} else {
					// Arrow function with parentheses: (tls) => ...
					const params = callback.field('parameters');
					if (params) {
						const identifiers = params.findAll({
							rule: { kind: 'identifier' },
						});
						if (identifiers.length > 0) {
							paramName = identifiers[0].text();
						}
					}
				}
			} else if (callback.kind() === 'function_expression') {
				// Function expression: function(tls) { ... }
				const params = callback.field('parameters');
				if (params) {
					const identifiers = params.findAll({ rule: { kind: 'identifier' } });
					if (identifiers.length > 0) {
						paramName = identifiers[0].text();
					}
				}
			}

			if (paramName) {
				out.push(`${paramName}.createSecurePair`);
			}
		}
	}

	return unique(out);
}

function collectNamedImportAliases(
	tlsStmts: SgNode<JS>[],
	importName: string,
): string[] {
	const out: string[] = [];

	for (const stmt of tlsStmts) {
		if (stmt.kind() !== 'import_declaration') continue;

		const specifiers = stmt.findAll({
			rule: {
				kind: 'import_specifier',
				has: { field: 'alias', kind: 'identifier' },
			},
		});

		for (const spec of specifiers) {
			const name = spec.field('name')?.text();
			const alias = spec.field('alias')?.text();
			if (name === importName && alias) {
				out.push(alias);
			}
		}
	}

	return out;
}

function collectCjsAliases(rootNode: SgNode<JS>): string[] {
	const out: string[] = [];

	const decls = rootNode.findAll({
		rule: {
			kind: 'variable_declarator',
			all: [
				{ has: { field: 'name', kind: 'object_pattern' } },
				{
					has: {
						field: 'value',
						any: [
							{ pattern: "require('tls')" },
							{ pattern: 'require("tls")' },
							{ pattern: "require('node:tls')" },
							{ pattern: 'require("node:tls")' },
						],
					},
				},
			],
		},
	});

	for (const decl of decls) {
		const objPattern = decl.field('name');
		if (!objPattern) continue;

		const pairPatterns = objPattern.findAll({
			rule: {
				kind: 'pair_pattern',
				has: { field: 'key', pattern: 'createSecurePair' },
			},
		});

		for (const pair of pairPatterns) {
			const value = pair.field('value')?.text();
			if (value) {
				out.push(value);
			}
		}
	}

	return unique(out);
}

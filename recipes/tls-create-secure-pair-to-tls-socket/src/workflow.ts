import type { SgRoot, SgNode, Edit } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';
import { getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';

type CallSite = { call: SgNode<JS>; binding: string };

export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const tlsStmts = [
		...getNodeImportStatements(root, 'tls'),
		...getNodeRequireCalls(root, 'tls'),
	];
	const cspBindings = unique([
		...tlsStmts.map(s => resolveBindingPath(s as unknown as SgNode<JS>, '$.createSecurePair')).filter(Boolean) as string[],
		...collectDefaultImportBindings(tlsStmts),
		...collectDynamicImportIdentifiers(rootNode),
	]);
	const callSites: CallSite[] = [...findCreateSecurePairCalls(rootNode)];
	const edits: Edit[] = [];
	for (const { call, binding } of callSites) {
		const a = getText(call.getMatch('A'));
		const b = getText(call.getMatch('B'));
		const c = getText(call.getMatch('C'));
		const d = getText(call.getMatch('D'));
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

function findCreateSecurePairCalls(rootNode: SgNode<JS>): CallSite[] {
	const pats = [
		'$X.createSecurePair($A, $B, $C, $D)',
		'$X.createSecurePair($A, $B, $C)',
		'$X.createSecurePair($A, $B)',
		'$X.createSecurePair($A)',
		'$X.createSecurePair()',
		'createSecurePair($A, $B, $C, $D)',
		'createSecurePair($A, $B, $C)',
		'createSecurePair($A, $B)',
		'createSecurePair($A)',
		'createSecurePair()',
	];
	const out: CallSite[] = [];
	for (const p of pats) {
		const nodes = rootNode.findAll({ rule: { kind: 'call_expression', pattern: p } });
		for (const n of nodes) {
			const x = (n as SgNode<JS>).getMatch('X')?.text();
			const binding = x ? `${x}.createSecurePair` : 'createSecurePair';
			out.push({ call: n as SgNode<JS>, binding });
		}
	}
	return out;
}

function buildOptions(a?: string | null, b?: string | null, c?: string | null, d?: string | null): string {
	const kv: string[] = [];
	if (a) kv.push(`secureContext: ${a}`);
	if (b) kv.push(`isServer: ${b}`);
	if (c) kv.push(`requestCert: ${c}`);
	if (d) kv.push(`rejectUnauthorized: ${d}`);
	return `{ ${kv.join(', ')} }`;
}

function getText(node: SgNode<JS> | undefined): string | null {
	const t = node?.text()?.trim();
	return t || null;
}

function unique<T>(arr: T[]): T[] {
	return Array.from(new Set(arr));
}

function renamePairAssignedVariables(rootNode: SgNode<JS>, _bindings: string[]): Edit[] {
	const edits: Edit[] = [];
	const decls = rootNode.findAll({
		rule: {
			kind: 'variable_declarator',
			has: {
				field: 'value',
				kind: 'call_expression',
				any: [
					{ pattern: '$X.createSecurePair($$$ARGS)' },
					{ pattern: 'createSecurePair($$$ARGS)' },
				],
			},
		},
	});
	for (const decl of decls) {
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
						any: [{ pattern: '\'tls\'' }, { pattern: '"tls"' }, { pattern: '\'node:tls\'' }, { pattern: '"node:tls"' }],
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
		const hasCSP = specs.some(s => s.field('name')?.text() === 'createSecurePair');
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
		const def = decl.find({ rule: { kind: 'import_clause', has: { field: 'name', kind: 'identifier' } } })?.field('name')?.text();
		const rebuilt = def ? `import ${def}, { ${kept.join(', ')} } from '${srcText}';` : `import { ${kept.join(', ')} } from '${srcText}';`;
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
							{ pattern: 'require(\'tls\')' },
							{ pattern: 'require("tls")' },
							{ pattern: 'require(\'node:tls\')' },
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
		const props = obj.findAll({ rule: { any: [{ kind: 'pair_pattern' }, { kind: 'shorthand_property_identifier_pattern' }] } });
		const hasCSP = props.some(p =>
			p.kind() === 'pair_pattern'
				? p.field('key')?.text() === 'createSecurePair' || p.field('value')?.text() === 'createSecurePair'
				: p.text() === 'createSecurePair'
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
		edits.push(stmt.replace(`const { ${kept.join(', ')} } = require('node:tls');`));
	}
	return edits;
}

function collectDefaultImportBindings(tlsStmts: SgNode<JS>[]): string[] {
	const out: string[] = [];
	for (const stmt of tlsStmts) {
		if (stmt.kind() !== 'import_declaration') continue;
		const src = stmt.field('source')?.text()?.replace(/['"]/g, '');
		if (!/^(node:)?tls$/.test(src || '')) continue;
		const def = stmt.find({ rule: { kind: 'import_clause', has: { field: 'name', kind: 'identifier' } } })?.field('name')?.text();
		if (def) out.push(`${def}.createSecurePair`);
	}
	return out;
}

function collectDynamicImportIdentifiers(rootNode: SgNode<JS>): string[] {
	const out: string[] = [];
	const pats = [
		'const $ID = await import(\'tls\')',
		'const $ID = await import("tls")',
		'const $ID = await import(\'node:tls\')',
		'const $ID = await import("node:tls")',
		'const $ID = import(\'tls\')',
		'const $ID = import("tls")',
		'const $ID = import(\'node:tls\')',
		'const $ID = import("node:tls")',
	];
	for (const p of pats) {
		const nodes = rootNode.findAll({ rule: { pattern: p } });
		for (const n of nodes) {
			const id = n.getMatch('ID')?.text();
			if (id) out.push(`${id}.createSecurePair`);
		}
	}
	return Array.from(new Set(out));
}

import type { SgRoot, SgNode, Edit } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';
import { getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';

type CallSite = { call: SgNode<JS>; binding: string };

export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const tlsStmts = [
		...getNodeImportStatements(root, 'node:tls'),
		...getNodeImportStatements(root, 'tls'),
		...getNodeRequireCalls(root, 'node:tls'),
		...getNodeRequireCalls(root, 'tls'),
	];
	if (tlsStmts.length === 0) return null;

	const cspBindings = unique(
		tlsStmts
			.map(s => resolveBindingPath(s as unknown as SgNode<JS>, '$.createSecurePair'))
			.filter(Boolean) as string[]
	);
	if (cspBindings.length === 0) return null;

	const callSites = findCreateSecurePairCalls(rootNode, cspBindings);
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

function findCreateSecurePairCalls(rootNode: SgNode<JS>, bindings: string[]): CallSite[] {
	return bindings.flatMap(binding =>
		rootNode
			.findAll({
				rule: {
					any: [
						{ pattern: `${binding}($A, $B, $C, $D)` },
						{ pattern: `${binding}($A, $B, $C)` },
						{ pattern: `${binding}($A, $B)` },
						{ pattern: `${binding}($A)` },
						{ pattern: `${binding}()` },
					],
				},
			})
			.map(n => ({ call: n as SgNode<JS>, binding }))
	);
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

function renamePairAssignedVariables(rootNode: SgNode<JS>, bindings: string[]): Edit[] {
	const edits: Edit[] = [];
	for (const binding of bindings) {
		const decls = rootNode.findAll({
			rule: {
				kind: 'variable_declarator',
				has: {
					field: 'value',
					kind: 'call_expression',
					pattern: `${binding}($$$ARGS)`,
				},
			},
		});
		for (const decl of decls) {
			const name = decl.field('name');
			if (name && name.kind() === 'identifier' && name.text() === 'pair') {
				edits.push(name.replace('socket'));
			}
		}
	}
	return edits;
}


function rewriteTlsImports(rootNode: SgNode<JS>): Edit[] {
	const edits: Edit[] = [];
	const tlsStmts = rootNode.findAll({
		rule: {
			any: [
				{ pattern: `import $$ANY from 'tls'` },
				{ pattern: `import $$ANY from 'node:tls'` },
				{ pattern: `const $$ANY = require('tls')` },
				{ pattern: `const $$ANY = require('node:tls')` },
			],
		},
	});

	for (const stmt of tlsStmts) {
		const code = stmt.text();
		if (/\bimport\s+\*\s+as\s+\w+\s+from\s+['"](tls|node:tls)['"]/.test(code)) continue;
		{
			const m = code.match(
				/import\s+(?:(?<def>[\w$]+)\s*,\s*)?\{\s*(?<names>[^}]*)\s*\}\s*from\s*['"](tls|node:tls)['"]\s*;?/,
			);
			if (m?.groups) {
				const def = m.groups.def || '';
				const namesRaw = m.groups.names || '';
				const names = namesRaw
					.split(',')
					.map(s => s.trim())
					.filter(Boolean)
					.map(s => s.replace(/\s+as\s+\w+$/, ''));

				if (names.includes('createSecurePair')) {
					const kept = Array.from(
						new Set(names.filter(n => n !== 'createSecurePair').concat('TLSSocket')),
					);
					const left = def ? `${def}, ` : '';
					const rebuilt = `import ${left}{ ${kept.join(', ')} } from 'node:tls';`;
					edits.push(stmt.replace(rebuilt));
					continue;
				}
			}
		}
		{
			const m = code.match(
				/const\s*\{\s*(?<names>[^}]*)\s*\}\s*=\s*require\(\s*['"](tls|node:tls)['"]\s*\)\s*;?/,
			);
			if (m?.groups) {
				const namesRaw = m.groups.names || '';
				const names = namesRaw
					.split(',')
					.map(s => s.trim())
					.filter(Boolean);

				if (names.includes('createSecurePair')) {
					const kept = Array.from(
						new Set(names.filter(n => n !== 'createSecurePair').concat('TLSSocket')),
					);
					const src = /node:tls/.test(code) ? 'node:tls' : 'tls';
					const rebuilt = `const { ${kept.join(', ')} } = require('${src}');`;
					edits.push(stmt.replace(rebuilt));
				}
			}
		}
	}

	return edits;
}

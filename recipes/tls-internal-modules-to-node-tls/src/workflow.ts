import type {
	Edit,
	Range,
	SgNode,
	SgRoot,
} from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import {
	getNodeImportStatements,
	getNodeImportCalls,
} from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';

/**
 * Public exports supported by each internal TLS module under DEP0192.
 */
const MODULE_EXPORTS: Record<string, ReadonlySet<string>> = {
	_tls_common: new Set(['SecureContext', 'createSecureContext']),
	_tls_wrap: new Set(['TLSSocket', 'Server', 'createServer', 'connect']),
};

const TARGET_MODULES = Object.keys(MODULE_EXPORTS);

function getInternalModuleName(specifier: string): string | null {
	const cleaned = specifier.replace(/^node:/, '');
	if (cleaned in MODULE_EXPORTS) {
		return cleaned;
	}
	return null;
}

function getUnquotedText(node: SgNode<Js>): string {
	return node.text().replace(/^['"`]|['"`]$/g, '');
}

function warn(root: SgRoot<Js>, node: SgNode<Js>, message: string): void {
	const { start } = node.range();
	console.warn(
		`${root.filename()}:${start.line + 1}:${start.column + 1}: ${message}`,
	);
}

type SpecifierInfo = {
	node: SgNode<Js>;
	text: string;
	imported: string;
	local: string;
};

type ImportStatementInfo = {
	statement: SgNode<Js>;
	sourceNode: SgNode<Js>;
	rawSource: string;
	internalMod: string;
	isTypeOnly: boolean;
	supported: SpecifierInfo[];
	unsupported: SpecifierInfo[];
};

/**
 * Handle DEP0192: migrate internal Node.js TLS modules (_tls_common, _tls_wrap) to node:tls.
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	// 1. Process ESM import statements using getNodeImportStatements utility
	processImportStatements(root, rootNode, edits, linesToRemove);

	// 2. Process ESM export statements (re-exports)
	processExportStatements(root, rootNode, edits);

	// 3. Process CommonJS require calls using getNodeRequireCalls utility
	processRequireCalls(root, rootNode, edits);

	// 4. Process dynamic import(...) calls using getNodeImportCalls utility
	processDynamicImports(root, rootNode, edits);

	if (edits.length === 0 && linesToRemove.length === 0) {
		return null;
	}

	const transformed = rootNode.commitEdits(edits);
	if (linesToRemove.length > 0) {
		return removeLines(transformed, linesToRemove);
	}

	return transformed;
}

/**
 * Handle ESM import statements:
 * - Uses getNodeImportStatements from @nodejs/codemod-utils for target and tls imports
 * - Replaces specifier with 'node:tls' when exports are supported
 * - Consolidates multiple compatible imports targeting 'node:tls'
 * - Splits mixed imports (retaining unsupported exports in the internal module)
 * - Skips and reports namespace and unsupported imports
 */
function processImportStatements(
	root: SgRoot<Js>,
	rootNode: SgNode<Js>,
	edits: Edit[],
	linesToRemove: Range[],
): void {
	// Find pre-existing node:tls imports using the workspace utility and type import matching
	const existingTlsStmts = [
		...getNodeImportStatements(root, 'tls'),
		...rootNode.findAll({
			rule: {
				kind: 'import_statement',
				has: {
					field: 'source',
					kind: 'string',
					has: {
						kind: 'string_fragment',
						regex: '^(node:)?tls$',
					},
				},
				pattern: 'import type $$$IMPORTS from $SOURCE',
			},
		}),
	];

	const existingTlsImports: {
		statement: SgNode<Js>;
		isTypeOnly: boolean;
		namedImports: SgNode<Js> | null;
	}[] = existingTlsStmts.map((stmt) => ({
		statement: stmt,
		isTypeOnly: stmt.text().startsWith('import type'),
		namedImports: stmt.find({ rule: { kind: 'named_imports' } }),
	}));

	const internalImports: ImportStatementInfo[] = [];

	for (const mod of TARGET_MODULES) {
		const statements = [
			...getNodeImportStatements(root, mod),
			...rootNode.findAll({
				rule: {
					kind: 'import_statement',
					has: {
						field: 'source',
						kind: 'string',
						has: {
							kind: 'string_fragment',
							regex: `^(node:)?${mod}$`,
						},
					},
					pattern: 'import type $$$IMPORTS from $SOURCE',
				},
			}),
		];

		for (const stmt of statements) {
			const sourceNode = stmt.field('source');
			if (!sourceNode) continue;

			const rawSource = getUnquotedText(sourceNode);
			const internalMod = getInternalModuleName(rawSource);
			if (!internalMod) continue;

			// Check for namespace import: import * as foo from '_tls_*'
			const nsImport = stmt.find({ rule: { kind: 'namespace_import' } });
			if (nsImport) {
				warn(
					root,
					stmt,
					`Namespace import '${nsImport.text()}' from '${rawSource}' is skipped; review manually (DEP0192)`,
				);
				continue;
			}

			const specifiers = stmt.findAll({ rule: { kind: 'import_specifier' } });
			if (specifiers.length === 0) {
				warn(
					root,
					stmt,
					`Import from '${rawSource}' without named specifiers is skipped; review manually (DEP0192)`,
				);
				continue;
			}

			const isTypeOnly = stmt.text().startsWith('import type');
			const supported: SpecifierInfo[] = [];
			const unsupported: SpecifierInfo[] = [];

			for (const spec of specifiers) {
				const nameNode = spec.field('name');
				const aliasNode = spec.field('alias');
				const imported = nameNode ? nameNode.text() : spec.text();
				const local = aliasNode ? aliasNode.text() : imported;

				if (MODULE_EXPORTS[internalMod].has(imported)) {
					supported.push({
						node: spec,
						text: spec.text(),
						imported,
						local,
					});
				} else {
					unsupported.push({
						node: spec,
						text: spec.text(),
						imported,
						local,
					});
					warn(
						root,
						spec,
						`Internal-only export '${imported}' from '${rawSource}' cannot be migrated to 'node:tls' (DEP0192)`,
					);
				}
			}

			if (supported.length > 0) {
				internalImports.push({
					statement: stmt,
					sourceNode,
					rawSource,
					internalMod,
					isTypeOnly,
					supported,
					unsupported,
				});
			}
		}
	}

	if (internalImports.length === 0) return;

	// Group internal imports by type-only status
	const valueInternal = internalImports.filter((i) => !i.isTypeOnly);
	const typeInternal = internalImports.filter((i) => i.isTypeOnly);

	consolidateImportsGroup(
		valueInternal,
		existingTlsImports.find((e) => !e.isTypeOnly),
		edits,
		linesToRemove,
	);

	consolidateImportsGroup(
		typeInternal,
		existingTlsImports.find((e) => e.isTypeOnly),
		edits,
		linesToRemove,
	);
}

function consolidateImportsGroup(
	imports: ImportStatementInfo[],
	existingTls:
		| {
				statement: SgNode<Js>;
				isTypeOnly: boolean;
				namedImports: SgNode<Js> | null;
		  }
		| undefined,
	edits: Edit[],
	linesToRemove: Range[],
): void {
	if (imports.length === 0) return;

	// Case 1: Consolidate into pre-existing node:tls import
	if (existingTls?.namedImports) {
		const existingNamedText = existingTls.namedImports.text();
		const existingSpecs = existingNamedText
			.replace(/^\{\s*|\s*\}$/g, '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);

		const specsToAdd: string[] = [];

		for (const imp of imports) {
			for (const sup of imp.supported) {
				if (!existingSpecs.includes(sup.text)) {
					specsToAdd.push(sup.text);
					existingSpecs.push(sup.text);
				}
			}

			if (imp.unsupported.length === 0) {
				linesToRemove.push(imp.statement.range());
			} else {
				const named = imp.statement.find({
					rule: { kind: 'named_imports' },
				});
				if (named) {
					const remaining = imp.unsupported.map((u) => u.text).join(', ');
					edits.push(named.replace(`{ ${remaining} }`));
				}
			}
		}

		if (specsToAdd.length > 0) {
			const allSpecs = [
				...existingNamedText
					.replace(/^\{\s*|\s*\}$/g, '')
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean),
				...specsToAdd,
			].join(', ');

			edits.push(existingTls.namedImports.replace(`{ ${allSpecs} }`));
		}
		return;
	}

	// Case 2: No pre-existing node:tls import, but multiple or single internal imports
	const [first, ...rest] = imports;

	if (rest.length === 0 && first.unsupported.length === 0) {
		edits.push(first.sourceNode.replace("'node:tls'"));
		return;
	}

	const consolidatedSpecs: string[] = [];
	for (const sup of first.supported) {
		if (!consolidatedSpecs.includes(sup.text)) {
			consolidatedSpecs.push(sup.text);
		}
	}

	for (const rem of rest) {
		for (const sup of rem.supported) {
			if (!consolidatedSpecs.includes(sup.text)) {
				consolidatedSpecs.push(sup.text);
			}
		}

		if (rem.unsupported.length === 0) {
			linesToRemove.push(rem.statement.range());
		} else {
			const named = rem.statement.find({
				rule: { kind: 'named_imports' },
			});
			if (named) {
				const remaining = rem.unsupported.map((u) => u.text).join(', ');
				edits.push(named.replace(`{ ${remaining} }`));
			}
		}
	}

	if (first.unsupported.length === 0) {
		edits.push(first.sourceNode.replace("'node:tls'"));
		const named = first.statement.find({ rule: { kind: 'named_imports' } });
		if (named) {
			edits.push(named.replace(`{ ${consolidatedSpecs.join(', ')} }`));
		}
	} else {
		const remaining = first.unsupported.map((u) => u.text).join(', ');
		const typePrefix = first.isTypeOnly ? 'type ' : '';
		const firstSource = first.sourceNode.text();
		const newStmt = `import ${typePrefix}{ ${remaining} } from ${firstSource};\nimport ${typePrefix}{ ${consolidatedSpecs.join(', ')} } from 'node:tls';`;
		edits.push(first.statement.replace(newStmt));
	}
}

/**
 * Handle ESM export statements (re-exports):
 * - export { TLSSocket } from '_tls_wrap';
 */
function processExportStatements(
	root: SgRoot<Js>,
	rootNode: SgNode<Js>,
	edits: Edit[],
): void {
	const exportStatements = rootNode.findAll({
		rule: { kind: 'export_statement' },
	});

	for (const stmt of exportStatements) {
		const sourceNode = stmt.field('source');
		if (!sourceNode) continue;

		const rawSource = getUnquotedText(sourceNode);
		const internalMod = getInternalModuleName(rawSource);
		if (!internalMod) continue;

		const specifiers = stmt.findAll({ rule: { kind: 'export_specifier' } });
		if (specifiers.length === 0) continue;

		const supported: SpecifierInfo[] = [];
		const unsupported: SpecifierInfo[] = [];

		for (const spec of specifiers) {
			const nameNode = spec.field('name');
			const aliasNode = spec.field('alias');
			const imported = nameNode ? nameNode.text() : spec.text();
			const local = aliasNode ? aliasNode.text() : imported;

			if (MODULE_EXPORTS[internalMod].has(imported)) {
				supported.push({
					node: spec,
					text: spec.text(),
					imported,
					local,
				});
			} else {
				unsupported.push({
					node: spec,
					text: spec.text(),
					imported,
					local,
				});
				warn(
					root,
					spec,
					`Internal-only re-export '${imported}' from '${rawSource}' cannot be migrated to 'node:tls' (DEP0192)`,
				);
			}
		}

		if (supported.length > 0 && unsupported.length === 0) {
			edits.push(sourceNode.replace("'node:tls'"));
		} else if (supported.length > 0 && unsupported.length > 0) {
			const remaining = unsupported.map((u) => u.text).join(', ');
			const supText = supported.map((s) => s.text).join(', ');
			const sourceText = sourceNode.text();
			const newStmt = `export { ${remaining} } from ${sourceText};\nexport { ${supText} } from 'node:tls';`;
			edits.push(stmt.replace(newStmt));
		}
	}
}

/**
 * Handle CommonJS require calls:
 * - Uses getNodeRequireCalls from @nodejs/codemod-utils for target modules
 * - Handles destructuring: const { TLSSocket } = require('_tls_wrap');
 * - Handles member expressions: const TLSSocket = require('_tls_wrap').TLSSocket;
 * - Skips and warns on namespace objects: const tls = require('_tls_wrap');
 */
function processRequireCalls(
	root: SgRoot<Js>,
	rootNode: SgNode<Js>,
	edits: Edit[],
): void {
	// Member expressions: const TLSSocket = require('_tls_wrap').TLSSocket;
	const memberRequires = rootNode.findAll({
		rule: {
			kind: 'member_expression',
			all: [
				{
					has: {
						field: 'object',
						kind: 'call_expression',
						all: [
							{
								has: {
									field: 'function',
									kind: 'identifier',
									regex: '^require$',
								},
							},
						],
					},
				},
			],
		},
	});

	for (const expr of memberRequires) {
		const call = expr.field('object');
		const stringArg = call?.field('arguments')?.find({ rule: { kind: 'string' } });
		if (!stringArg) continue;

		const rawSource = getUnquotedText(stringArg);
		const internalMod = getInternalModuleName(rawSource);
		if (!internalMod) continue;

		const prop = expr.field('property');
		if (prop && MODULE_EXPORTS[internalMod].has(prop.text())) {
			edits.push(stringArg.replace("'node:tls'"));
		} else {
			warn(
				root,
				prop || expr,
				`Unknown/internal property '${prop?.text()}' on '${rawSource}' is skipped; review manually (DEP0192)`,
			);
		}
	}

	// Use getNodeRequireCalls from local workspace utility for variable declarations
	for (const mod of TARGET_MODULES) {
		const declarators = getNodeRequireCalls(root, mod);

		for (const declarator of declarators) {
			if (declarator.field('value')?.is('member_expression')) continue;

			const call = declarator.find({
				rule: {
					kind: 'call_expression',
					has: { field: 'function', regex: '^require$' },
				},
			});
			const stringArg = call?.field('arguments')?.find({ rule: { kind: 'string' } });
			if (!stringArg) continue;

			const rawSource = getUnquotedText(stringArg);
			const namePattern = declarator.field('name');

			if (namePattern?.is('object_pattern')) {
				const shorthandProps = namePattern.findAll({
					rule: { kind: 'shorthand_property_identifier_pattern' },
				});
				const pairProps = namePattern.findAll({
					rule: { kind: 'pair_pattern' },
				});

				const supportedNames: string[] = [];
				const unsupportedNames: string[] = [];

				for (const sh of shorthandProps) {
					const name = sh.text();
					if (MODULE_EXPORTS[mod].has(name)) {
						supportedNames.push(name);
					} else {
						unsupportedNames.push(name);
						warn(
							root,
							sh,
							`Internal-only export '${name}' from '${rawSource}' cannot be migrated to 'node:tls' (DEP0192)`,
						);
					}
				}

				for (const pair of pairProps) {
					const key = pair.field('key')?.text() || '';
					if (MODULE_EXPORTS[mod].has(key)) {
						supportedNames.push(pair.text());
					} else {
						unsupportedNames.push(pair.text());
						warn(
							root,
							pair,
							`Internal-only export '${key}' from '${rawSource}' cannot be migrated to 'node:tls' (DEP0192)`,
						);
					}
				}

				if (supportedNames.length > 0 && unsupportedNames.length === 0) {
					edits.push(stringArg.replace("'node:tls'"));
				} else if (
					supportedNames.length > 0 &&
					unsupportedNames.length > 0
				) {
					const declParent = declarator.parent();
					const kind = declParent?.kind() === 'lexical_declaration' ? 'const' : 'var';
					const newDecl = `${kind} { ${unsupportedNames.join(', ')} } = require(${stringArg.text()});\n${kind} { ${supportedNames.join(', ')} } = require('node:tls');`;
					if (declParent) {
						edits.push(declParent.replace(newDecl));
					}
				}
				continue;
			}

			// Un-destructured namespace object: const tls = require('_tls_wrap')
			warn(
				root,
				declarator,
				`Namespace object '${namePattern?.text()}' from '${rawSource}' is skipped; review manually (DEP0192)`,
			);
		}
	}
}

/**
 * Handle dynamic import(...) calls:
 * - Uses getNodeImportCalls from @nodejs/codemod-utils for target modules
 * - Handles: const { TLSSocket } = await import('_tls_wrap');
 * - Handles: import('_tls_wrap').then(m => m.connect);
 */
function processDynamicImports(
	root: SgRoot<Js>,
	rootNode: SgNode<Js>,
	edits: Edit[],
): void {
	for (const mod of TARGET_MODULES) {
		const declarators = getNodeImportCalls(root, mod);

		for (const declarator of declarators) {
			const name = declarator.field('name');
			if (name?.is('object_pattern')) {
				const props = name.findAll({
					rule: {
						any: [
							{ kind: 'shorthand_property_identifier_pattern' },
							{ kind: 'pair_pattern' },
						],
					},
				});
				const allSupported =
					props.length > 0 &&
					props.every((p) => {
						const key =
							p.is('pair_pattern') ? p.field('key')?.text() || '' : p.text();
						return MODULE_EXPORTS[mod].has(key);
					});

				if (allSupported) {
					const stringArg = declarator.find({
						rule: { kind: 'string' },
					});
					if (stringArg) {
						edits.push(stringArg.replace("'node:tls'"));
					}
				}
			}
		}
	}

	// Chained .then(...) calls: import('_tls_*').then(...)
	const thenImports = rootNode.findAll({
		rule: {
			kind: 'call_expression',
			all: [
				{
					has: {
						field: 'function',
						kind: 'member_expression',
						has: { field: 'property', regex: '^then$' },
					},
				},
			],
		},
	});

	for (const thenCall of thenImports) {
		const memberFn = thenCall.field('function');
		const objectCall = memberFn?.field('object');
		if (!objectCall?.is('call_expression')) continue;

		const importFn = objectCall.field('function');
		if (importFn?.kind() !== 'import') continue;

		const stringArg = objectCall.field('arguments')?.find({ rule: { kind: 'string' } });
		if (!stringArg) continue;

		const rawSource = getUnquotedText(stringArg);
		const internalMod = getInternalModuleName(rawSource);
		if (!internalMod) continue;

		const callback = thenCall.field('arguments')?.child(1);
		if (!callback) continue;

		let isSupported = false;
		const param = callback.field('parameters') || callback.field('parameter');
		if (param) {
			const destructured = param.findAll({
				rule: {
					any: [
						{ kind: 'shorthand_property_identifier_pattern' },
						{ kind: 'pair_pattern' },
					],
				},
			});
			if (
				destructured.length > 0 &&
				destructured.every((p) => {
					const key =
						p.is('pair_pattern') ? p.field('key')?.text() || '' : p.text();
					return MODULE_EXPORTS[internalMod].has(key);
				})
			) {
				isSupported = true;
			}
		}

		const members = callback.findAll({
			rule: { kind: 'member_expression' },
		});
		for (const m of members) {
			const prop = m.field('property')?.text() || '';
			if (MODULE_EXPORTS[internalMod].has(prop)) {
				isSupported = true;
				break;
			}
		}

		if (isSupported) {
			edits.push(stringArg.replace("'node:tls'"));
		} else {
			warn(
				root,
				thenCall,
				`Dynamic import of '${rawSource}' without verified public exports is skipped; review manually (DEP0192)`,
			);
		}
	}
}

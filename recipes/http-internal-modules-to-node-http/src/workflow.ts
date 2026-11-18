import type {
	Edit,
	Range,
	SgNode,
	SgRoot,
} from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';

/**
 * Public exports supported by each internal HTTP module under DEP0199.
 */
const MODULE_EXPORTS: Record<string, ReadonlySet<string>> = {
	_http_agent: new Set(['Agent', 'globalAgent']),
	_http_client: new Set(['ClientRequest']),
	_http_incoming: new Set(['IncomingMessage']),
	_http_outgoing: new Set([
		'OutgoingMessage',
		'validateHeaderName',
		'validateHeaderValue',
	]),
	_http_server: new Set(['Server', 'ServerResponse', 'STATUS_CODES']),
};

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
 * Handle DEP0199: migrate internal Node.js HTTP modules (_http_*) to node:http.
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	// Check for excluded modules like _http_common
	const allStrings = rootNode.findAll({ rule: { kind: 'string' } });
	for (const str of allStrings) {
		const unquoted = getUnquotedText(str);
		if (unquoted.replace(/^node:/, '') === '_http_common') {
			warn(
				root,
				str,
				'_http_common internals such as HTTPParser are excluded from migration to node:http (DEP0199)',
			);
		}
	}

	// 1. Process ESM import statements
	processImportStatements(root, rootNode, edits, linesToRemove);

	// 2. Process ESM export statements (re-exports)
	processExportStatements(root, rootNode, edits);

	// 3. Process CommonJS require calls
	processRequireCalls(root, rootNode, edits);

	// 4. Process dynamic import(...) calls
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
 * - Replaces specifier with 'node:http' when exports are supported
 * - Consolidates multiple compatible imports targeting 'node:http'
 * - Splits mixed imports (retaining unsupported exports in the internal module)
 * - Skips and reports namespace and unsupported imports
 */
function processImportStatements(
	root: SgRoot<Js>,
	rootNode: SgNode<Js>,
	edits: Edit[],
	linesToRemove: Range[],
): void {
	const importStatements = rootNode.findAll({
		rule: { kind: 'import_statement' },
	});

	// Find pre-existing node:http imports
	const existingHttpImports: {
		statement: SgNode<Js>;
		isTypeOnly: boolean;
		namedImports: SgNode<Js> | null;
	}[] = [];

	const internalImports: ImportStatementInfo[] = [];

	for (const stmt of importStatements) {
		const sourceNode = stmt.field('source');
		if (!sourceNode) continue;

		const rawSource = getUnquotedText(sourceNode);
		const normalized = rawSource.replace(/^node:/, '');

		if (normalized === 'http') {
			const isTypeOnly = stmt.text().startsWith('import type');
			const namedImports = stmt.find({ rule: { kind: 'named_imports' } });
			existingHttpImports.push({ statement: stmt, isTypeOnly, namedImports });
			continue;
		}

		const internalMod = getInternalModuleName(rawSource);
		if (!internalMod) continue;

		// Check for namespace import: import * as foo from '_http_*'
		const nsImport = stmt.find({ rule: { kind: 'namespace_import' } });
		if (nsImport) {
			warn(
				root,
				stmt,
				`Namespace import '${nsImport.text()}' from '${rawSource}' is skipped; review manually (DEP0199)`,
			);
			continue;
		}

		const specifiers = stmt.findAll({ rule: { kind: 'import_specifier' } });
		if (specifiers.length === 0) {
			warn(
				root,
				stmt,
				`Import from '${rawSource}' without named specifiers is skipped; review manually (DEP0199)`,
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
					`Internal-only export '${imported}' from '${rawSource}' cannot be migrated to 'node:http' (DEP0199)`,
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

	if (internalImports.length === 0) return;

	// Group internal imports by type-only status
	const valueInternal = internalImports.filter((i) => !i.isTypeOnly);
	const typeInternal = internalImports.filter((i) => i.isTypeOnly);

	consolidateImportsGroup(
		valueInternal,
		existingHttpImports.find((e) => !e.isTypeOnly),
		edits,
		linesToRemove,
	);

	consolidateImportsGroup(
		typeInternal,
		existingHttpImports.find((e) => e.isTypeOnly),
		edits,
		linesToRemove,
	);
}

function consolidateImportsGroup(
	imports: ImportStatementInfo[],
	existingHttp:
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

	// Case 1: Consolidate into pre-existing node:http import
	if (existingHttp?.namedImports) {
		const existingNamedText = existingHttp.namedImports.text();
		// Parse existing specifiers
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
				// Entire import migrated; remove line
				linesToRemove.push(imp.statement.range());
			} else {
				// Mixed import: keep only unsupported specifiers
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

			edits.push(existingHttp.namedImports.replace(`{ ${allSpecs} }`));
		}
		return;
	}

	// Case 2: No pre-existing node:http import, but multiple or single internal imports
	const [first, ...rest] = imports;

	if (rest.length === 0 && first.unsupported.length === 0) {
		// Single completely supported import: just update source
		edits.push(first.sourceNode.replace("'node:http'"));
		return;
	}

	// Consolidate into first
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
		// Replace first statement's source and specifiers
		edits.push(first.sourceNode.replace("'node:http'"));
		const named = first.statement.find({ rule: { kind: 'named_imports' } });
		if (named) {
			edits.push(named.replace(`{ ${consolidatedSpecs.join(', ')} }`));
		}
	} else {
		// First was mixed: keep unsupported in first, and append new node:http import
		const remaining = first.unsupported.map((u) => u.text).join(', ');
		const typePrefix = first.isTypeOnly ? 'type ' : '';
		const firstSource = first.sourceNode.text();
		const newStmt = `import ${typePrefix}{ ${remaining} } from ${firstSource};\nimport ${typePrefix}{ ${consolidatedSpecs.join(', ')} } from 'node:http';`;
		edits.push(first.statement.replace(newStmt));
	}
}

/**
 * Handle ESM export statements (re-exports):
 * - export { IncomingMessage } from '_http_incoming';
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
					`Internal-only re-export '${imported}' from '${rawSource}' cannot be migrated to 'node:http' (DEP0199)`,
				);
			}
		}

		if (supported.length > 0 && unsupported.length === 0) {
			edits.push(sourceNode.replace("'node:http'"));
		} else if (supported.length > 0 && unsupported.length > 0) {
			// Mixed re-export: keep unsupported, add supported
			const remaining = unsupported.map((u) => u.text).join(', ');
			const supText = supported.map((s) => s.text).join(', ');
			const sourceText = sourceNode.text();
			const newStmt = `export { ${remaining} } from ${sourceText};\nexport { ${supText} } from 'node:http';`;
			edits.push(stmt.replace(newStmt));
		}
	}
}

/**
 * Handle CommonJS require calls:
 * - const { Server } = require('_http_server');
 * - const Server = require('_http_server').Server;
 * - const agent = require('_http_agent'); (skipped / warned)
 */
function processRequireCalls(
	root: SgRoot<Js>,
	rootNode: SgNode<Js>,
	edits: Edit[],
): void {
	const requireCalls = rootNode.findAll({
		rule: {
			kind: 'call_expression',
			has: {
				field: 'function',
				kind: 'identifier',
				regex: '^require$',
			},
		},
	});

	for (const call of requireCalls) {
		const args = call.field('arguments');
		if (!args) continue;

		const stringArg = args.find({ rule: { kind: 'string' } });
		if (!stringArg) continue;

		const rawSource = getUnquotedText(stringArg);
		const internalMod = getInternalModuleName(rawSource);
		if (!internalMod) continue;

		const parent = call.parent();
		if (!parent) continue;

		// Case A: Member expression: require('_http_server').Server
		if (parent.is('member_expression')) {
			const prop = parent.field('property');
			if (prop && MODULE_EXPORTS[internalMod].has(prop.text())) {
				edits.push(stringArg.replace("'node:http'"));
			} else {
				warn(
					root,
					prop || call,
					`Unknown/internal property '${prop?.text()}' on '${rawSource}' is skipped; review manually (DEP0199)`,
				);
			}
			continue;
		}

		// Case B: Variable declarator: const { Server } = require(...)
		if (parent.is('variable_declarator')) {
			const namePattern = parent.field('name');
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
					if (MODULE_EXPORTS[internalMod].has(name)) {
						supportedNames.push(name);
					} else {
						unsupportedNames.push(name);
						warn(
							root,
							sh,
							`Internal-only export '${name}' from '${rawSource}' cannot be migrated to 'node:http' (DEP0199)`,
						);
					}
				}

				for (const pair of pairProps) {
					const key = pair.field('key')?.text() || '';
					if (MODULE_EXPORTS[internalMod].has(key)) {
						supportedNames.push(pair.text());
					} else {
						unsupportedNames.push(pair.text());
						warn(
							root,
							pair,
							`Internal-only export '${key}' from '${rawSource}' cannot be migrated to 'node:http' (DEP0199)`,
						);
					}
				}

				if (supportedNames.length > 0 && unsupportedNames.length === 0) {
					edits.push(stringArg.replace("'node:http'"));
				} else if (
					supportedNames.length > 0 &&
					unsupportedNames.length > 0
				) {
					// Mixed destructuring: keep unsupported, add new require for supported
					const declParent = parent.parent(); // lexical_declaration or variable_declaration
					const kind = declParent?.kind() === 'lexical_declaration' ? 'const' : 'var';
					const newDecl = `${kind} { ${unsupportedNames.join(', ')} } = require(${stringArg.text()});\n${kind} { ${supportedNames.join(', ')} } = require('node:http');`;
					if (declParent) {
						edits.push(declParent.replace(newDecl));
					}
				}
				continue;
			}

			// Case C: Un-destructured namespace object: const agent = require('_http_agent')
			warn(
				root,
				parent,
				`Namespace object '${namePattern?.text()}' from '${rawSource}' is skipped; review manually (DEP0199)`,
			);
		}
	}
}

/**
 * Handle dynamic import(...) calls:
 * - const { Server } = await import('_http_server');
 * - const server = await import('_http_server').then(m => m.Server);
 */
function processDynamicImports(
	root: SgRoot<Js>,
	rootNode: SgNode<Js>,
	edits: Edit[],
): void {
	const dynamicImports = rootNode.findAll({
		rule: {
			kind: 'call_expression',
			has: {
				field: 'function',
				kind: 'import',
			},
		},
	});

	for (const call of dynamicImports) {
		const args = call.field('arguments');
		if (!args) continue;

		const stringArg = args.find({ rule: { kind: 'string' } });
		if (!stringArg) continue;

		const rawSource = getUnquotedText(stringArg);
		const internalMod = getInternalModuleName(rawSource);
		if (!internalMod) continue;

		// Walk up to find if exports are destructured or accessed via .then
		const current: SgNode<Js> | null = call;
		let isSupported = false;

		// Check parent: await import(...)
		const parent = current.parent();
		if (parent?.is('await_expression')) {
			const grandParent = parent.parent();
			if (grandParent?.is('variable_declarator')) {
				const name = grandParent.field('name');
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
							return MODULE_EXPORTS[internalMod].has(key);
						});
					if (allSupported) {
						isSupported = true;
					}
				}
			}
		}

		// Check chained .then: import(...).then(...)
		const callParent = call.parent();
		if (
			callParent?.is('member_expression') &&
			callParent.field('property')?.text() === 'then'
		) {
			const thenCall = callParent.parent();
			if (thenCall?.is('call_expression')) {
				const thenArgs = thenCall.field('arguments');
				const callback = thenArgs?.child(1); // child(0) is '(', child(1) is callback function
				if (callback) {
					// Check if callback accesses supported member: m => m.Server or ({ Server }) => ...
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
					// Check return / body member expression: m.Server
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
				}
			}
		}

		if (isSupported) {
			edits.push(stringArg.replace("'node:http'"));
		} else {
			warn(
				root,
				call,
				`Dynamic import of '${rawSource}' without verified public exports is skipped; review manually (DEP0199)`,
			);
		}
	}
}

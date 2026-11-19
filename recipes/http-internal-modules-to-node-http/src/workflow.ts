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

const TARGET_MODULES = Object.keys(MODULE_EXPORTS);

function getInternalModuleName(specifier: string): string | null {
	const cleaned = specifier.replace(/^node:/, '');
	if (cleaned in MODULE_EXPORTS) {
		return cleaned;
	}
	return null;
}

function getUnquotedText(node: SgNode<Js>): string {
	return node.find({ rule: { kind: 'string_fragment' } })?.text() ?? '';
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
	const nl = rootNode.text().includes('\r\n') ? '\r\n' : '\n';

	// Warn on excluded modules like _http_common
	const allCommons = rootNode.findAll({
		rule: {
			kind: 'string_fragment',
			regex: '^(node:)?_http_common$',
		},
	});
	for (const frag of allCommons) {
		const str = frag.parent() ?? frag;
		warn(
			root,
			str,
			'_http_common internals such as HTTPParser are excluded from migration to node:http (DEP0199)',
		);
	}

	// 1. Process ESM import statements using getNodeImportStatements utility
	processImportStatements(root, rootNode, edits, linesToRemove, nl);

	// 2. Process ESM export statements (re-exports)
	processExportStatements(root, rootNode, edits);

	// 3. Process CommonJS require calls using getNodeRequireCalls utility
	processRequireCalls(root, rootNode, edits, nl);

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
 * - Uses getNodeImportStatements from @nodejs/codemod-utils for target and http imports
 * - Replaces specifier with 'node:http' when exports are supported
 * - Consolidates multiple compatible imports targeting 'node:http'
 * - Splits mixed imports (retaining unsupported exports in the internal module)
 * - Skips and reports namespace and unsupported imports
 */
function processImportStatements(
	root: SgRoot<Js>,
	_rootNode: SgNode<Js>,
	edits: Edit[],
	linesToRemove: Range[],
	nl: string,
): void {
	const existingHttpStmts = getNodeImportStatements(root, 'http');

	const existingHttpImports = existingHttpStmts.map((stmt) => ({
		statement: stmt,
		namedImports: stmt.find({ rule: { kind: 'named_imports' } }),
	}));

	const internalImports: ImportStatementInfo[] = [];

	for (const mod of TARGET_MODULES) {
		const statements = getNodeImportStatements(root, mod);

		for (const stmt of statements) {
			const sourceNode = stmt.field('source');
			if (!sourceNode) continue;

			const rawSource = getUnquotedText(sourceNode);
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
					supported,
					unsupported,
				});
			}
		}
	}

	if (internalImports.length === 0) return;

	consolidateImports(
		internalImports,
		existingHttpImports[0],
		edits,
		linesToRemove,
		nl,
	);
}

function consolidateImports(
	imports: ImportStatementInfo[],
	existingHttp:
		| {
				statement: SgNode<Js>;
				namedImports: SgNode<Js> | null;
		  }
		| undefined,
	edits: Edit[],
	linesToRemove: Range[],
	nl: string,
): void {
	// Case 1: An existing node:http import already exists
	if (existingHttp?.namedImports) {
		const existingNamedText = existingHttp.namedImports.text();
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

			edits.push(existingHttp.namedImports.replace(`{ ${allSpecs} }`));
		}
		return;
	}

	// Case 2: No pre-existing node:http import, but multiple or single internal imports
	const [first, ...rest] = imports;

	if (rest.length === 0 && first.unsupported.length === 0) {
		edits.push(first.sourceNode.replace("'node:http'"));
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
		edits.push(first.sourceNode.replace("'node:http'"));
		const named = first.statement.find({ rule: { kind: 'named_imports' } });
		if (named) {
			edits.push(named.replace(`{ ${consolidatedSpecs.join(', ')} }`));
		}
	} else {
		const remaining = first.unsupported.map((u) => u.text).join(', ');
		const firstSource = first.sourceNode.text();
		const newStmt = `import { ${remaining} } from ${firstSource};${nl}import { ${consolidatedSpecs.join(', ')} } from 'node:http';`;
		edits.push(first.statement.replace(newStmt));
	}
}

/**
 * Handle ESM export statements (re-exports):
 * - export { Server } from '_http_server';
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

		const supportedNames: string[] = [];
		const unsupportedNames: string[] = [];

		for (const spec of specifiers) {
			const nameNode = spec.field('name');
			const exportedName = nameNode ? nameNode.text() : spec.text();

			if (MODULE_EXPORTS[internalMod].has(exportedName)) {
				supportedNames.push(spec.text());
			} else {
				unsupportedNames.push(spec.text());
				warn(
					root,
					spec,
					`Internal-only export '${exportedName}' from '${rawSource}' cannot be re-exported from 'node:http' (DEP0199)`,
				);
			}
		}

		if (supportedNames.length > 0 && unsupportedNames.length === 0) {
			edits.push(sourceNode.replace("'node:http'"));
		} else if (supportedNames.length > 0 && unsupportedNames.length > 0) {
			warn(
				root,
				stmt,
				`Export statement from '${rawSource}' contains mixed public and internal-only exports; review manually (DEP0199)`,
			);
		}
	}
}

/**
 * Handle CommonJS require calls:
 * - Uses getNodeRequireCalls from @nodejs/codemod-utils for target modules
 * - Handles destructuring: const { Server } = require('_http_server');
 * - Handles member expressions: const Server = require('_http_server').Server;
 * - Skips and warns on namespace objects: const agent = require('_http_agent');
 */
function processRequireCalls(
	root: SgRoot<Js>,
	_rootNode: SgNode<Js>,
	edits: Edit[],
	nl: string,
): void {
	for (const mod of TARGET_MODULES) {
		const declarators = getNodeRequireCalls(root, mod);

		for (const declarator of declarators) {
			const value = declarator.field('value');
			if (!value) continue;

			// Member expressions: const Server = require('_http_server').Server;
			if (value.is('member_expression')) {
				const call = value.find({ rule: { kind: 'call_expression' } });
				const stringArg = call?.find({ rule: { kind: 'string' } });
				if (!stringArg) continue;

				const prop = value.field('property');
				const propName = prop?.text() || '';

				if (MODULE_EXPORTS[mod].has(propName)) {
					edits.push(stringArg.replace("'node:http'"));
				} else {
					warn(
						root,
						prop || value,
						`Unknown/internal property '${propName}' on '${getUnquotedText(stringArg)}' is skipped; review manually (DEP0199)`,
					);
				}
				continue;
			}

			// Call expressions with destructuring: const { Server } = require('_http_server');
			const call = value.is('call_expression')
				? value
				: value.find({
						rule: {
							kind: 'call_expression',
							has: { field: 'function', regex: '^require$' },
						},
					});
			const stringArg = call?.find({ rule: { kind: 'string' } });
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
							`Internal-only export '${name}' from '${rawSource}' cannot be migrated to 'node:http' (DEP0199)`,
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
					const declParent = declarator.parent();
					const kind = declParent?.is('lexical_declaration') ? 'const' : 'var';
					const newDecl = `${kind} { ${unsupportedNames.join(', ')} } = require(${stringArg.text()});${nl}${kind} { ${supportedNames.join(', ')} } = require('node:http');`;
					if (declParent) {
						edits.push(declParent.replace(newDecl));
					}
				}
				continue;
			}

			// Un-destructured namespace object: const agent = require('_http_agent')
			warn(
				root,
				declarator,
				`Namespace object '${namePattern?.text()}' from '${rawSource}' is skipped; review manually (DEP0199)`,
			);
		}
	}
}

/**
 * Handle dynamic import(...) calls:
 * - Uses getNodeImportCalls from @nodejs/codemod-utils for target modules
 * - Handles: const { Server } = await import('_http_server');
 * - Handles: import('_http_server').then(m => m.createServer);
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
						edits.push(stringArg.replace("'node:http'"));
					}
				}
			}
		}
	}

	// Chained .then(...) calls: import('_http_*').then(...)
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
		if (!importFn?.is('import')) continue;

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
			edits.push(stringArg.replace("'node:http'"));
		} else {
			warn(
				root,
				thenCall,
				`Dynamic import of '${rawSource}' without verified public exports is skipped; review manually (DEP0199)`,
			);
		}
	}
}

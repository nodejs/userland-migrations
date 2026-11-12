import type {
	Edit,
	Range,
	Rule,
	SgNode,
	SgRoot,
} from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

/**
 * Deprecated `node:sqlite` class names (DEP0210, DEP0211) and their
 * replacements.
 */
const RENAMES = new Map([
	['DatabaseSync', 'Database'],
	['StatementSync', 'Statement'],
]);

const RENAME_REGEX = `^(${[...RENAMES.keys()].join('|')})$`;

const SQLITE_SOURCE: Rule<Js> = {
	kind: 'string',
	has: { kind: 'string_fragment', regex: '^node:sqlite$' },
};

const REQUIRE_CALL: Rule<Js> = {
	kind: 'call_expression',
	all: [
		{ has: { field: 'function', kind: 'identifier', regex: '^require$' } },
		{ has: { field: 'arguments', has: SQLITE_SOURCE } },
	],
};

const IMPORT_CALL: Rule<Js> = {
	kind: 'call_expression',
	all: [
		{ has: { field: 'function', kind: 'import' } },
		{ has: { field: 'arguments', has: SQLITE_SOURCE } },
	],
};

/**
 * Every node that can name a binding or a reference. `type_identifier` is
 * only produced by the TypeScript grammar, so it is missing from the
 * JavaScript kind union.
 */
const NAME_RULE = {
	any: [
		'identifier',
		'type_identifier',
		'shorthand_property_identifier',
		'shorthand_property_identifier_pattern',
	].map((kind) => ({ kind })),
} as Rule<Js>;

/** `Namespace.Type` in TypeScript; missing from the JavaScript kind union. */
const NESTED_TYPE_KIND: string = 'nested_type_identifier';

/** Declarations whose `name` field introduces a binding. */
const NAMED_DECLARATIONS = new Set([
	'abstract_class_declaration',
	'class',
	'class_declaration',
	'enum_declaration',
	'function_declaration',
	'function_expression',
	'function_signature',
	'generator_function',
	'generator_function_declaration',
	'interface_declaration',
	'internal_module',
	'module',
	'type_alias_declaration',
]);

/** Parents whose direct identifier children are always bindings. */
const BINDING_PARENTS = new Set([
	'array_pattern',
	'formal_parameters',
	'import_clause',
	'import_specifier',
	'namespace_import',
	'rest_pattern',
	'type_parameter',
]);

/** Field that holds the binding for parents that also contain references. */
const BINDING_FIELDS: Record<string, string> = {
	arrow_function: 'parameter',
	assignment_pattern: 'left',
	catch_clause: 'parameter',
	for_in_statement: 'left',
	optional_parameter: 'pattern',
	pair_pattern: 'value',
	required_parameter: 'pattern',
	variable_declarator: 'name',
};

type Context = {
	rootNode: SgNode<Js>;
	edits: Edit[];
	/** Ranges of the `node:sqlite` import, export, and require statements. */
	ownRanges: Range[];
};

/**
 * Handle DEP0210 and DEP0211: rename the `node:sqlite` classes `DatabaseSync`
 * and `StatementSync` to `Database` and `Statement`.
 *
 * Only bindings that resolve to `node:sqlite` are migrated. When renaming a
 * local binding could collide with or be shadowed by another binding, the
 * import keeps the old local name as an alias, for example
 * `import { Database as DatabaseSync } from 'node:sqlite'`. Public export
 * names are never changed.
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();

	const imports = rootNode.findAll({
		rule: {
			kind: 'import_statement',
			has: { field: 'source', ...SQLITE_SOURCE },
		},
	});
	const reExports = rootNode.findAll({
		rule: {
			kind: 'export_statement',
			has: { field: 'source', ...SQLITE_SOURCE },
		},
	});
	const declarators = rootNode.findAll({
		rule: {
			kind: 'variable_declarator',
			has: {
				field: 'value',
				any: [REQUIRE_CALL, { kind: 'await_expression', has: IMPORT_CALL }],
			},
		},
	});
	const directAccesses = rootNode.findAll({
		rule: {
			kind: 'member_expression',
			all: [
				{ has: { field: 'object', ...REQUIRE_CALL } },
				{ has: { field: 'property', regex: RENAME_REGEX } },
			],
		},
	});

	const ctx: Context = {
		rootNode,
		edits: [],
		ownRanges: [...imports, ...reExports, ...declarators].map((node) =>
			node.range(),
		),
	};

	for (const statement of imports) {
		migrateImportStatement(root, ctx, statement);
	}

	for (const statement of reExports) {
		migrateReExport(ctx, statement);
	}

	for (const declarator of declarators) {
		migrateDeclarator(root, ctx, declarator);
	}

	for (const access of directAccesses) {
		renameProperty(ctx, access.field('property'));
	}

	if (!ctx.edits.length) return null;

	return rootNode.commitEdits(ctx.edits);
}

/**
 * `import { DatabaseSync } from 'node:sqlite'`,
 * `import * as sqlite from 'node:sqlite'`, and
 * `import sqlite from 'node:sqlite'`.
 */
function migrateImportStatement(
	root: SgRoot<Js>,
	ctx: Context,
	statement: SgNode<Js>,
): void {
	const clause = statement.find({ rule: { kind: 'import_clause' } });
	if (!clause) return;

	for (const child of clause.children()) {
		switch (child.kind()) {
			case 'identifier':
				migrateNamespace(root, ctx, child);
				break;
			case 'namespace_import': {
				const local = child.find({ rule: { kind: 'identifier' } });
				if (local) migrateNamespace(root, ctx, local);
				break;
			}
			case 'named_imports':
				for (const specifier of child.findAll({
					rule: { kind: 'import_specifier' },
				})) {
					migrateImportSpecifier(ctx, specifier);
				}
				break;
		}
	}
}

function migrateImportSpecifier(ctx: Context, specifier: SgNode<Js>): void {
	const name = specifier.field('name');
	if (!name) return;

	const oldName = name.text();
	const newName = RENAMES.get(oldName);
	if (!newName) return;

	if (specifier.field('alias')) {
		ctx.edits.push(name.replace(newName));
		return;
	}

	if (canRenameBinding(ctx, oldName, newName)) {
		ctx.edits.push(name.replace(newName));
		renameReferences(ctx, oldName, newName);
		return;
	}

	ctx.edits.push(name.replace(`${newName} as ${oldName}`));
}

/**
 * `export { DatabaseSync } from 'node:sqlite'` keeps its public name:
 * `export { Database as DatabaseSync } from 'node:sqlite'`.
 */
function migrateReExport(ctx: Context, statement: SgNode<Js>): void {
	for (const specifier of statement.findAll({
		rule: { kind: 'export_specifier' },
	})) {
		const name = specifier.field('name');
		if (!name) continue;

		const oldName = name.text();
		const newName = RENAMES.get(oldName);
		if (!newName) continue;

		ctx.edits.push(
			name.replace(
				specifier.field('alias') ? newName : `${newName} as ${oldName}`,
			),
		);
	}
}

/**
 * `const { DatabaseSync } = require('node:sqlite')`,
 * `const sqlite = require('node:sqlite')`, and the same forms with
 * `await import('node:sqlite')`.
 */
function migrateDeclarator(
	root: SgRoot<Js>,
	ctx: Context,
	declarator: SgNode<Js>,
): void {
	const name = declarator.field('name');
	if (!name) return;

	if (name.kind() === 'identifier') {
		migrateNamespace(root, ctx, name);
		return;
	}

	if (name.kind() !== 'object_pattern') return;

	for (const entry of name.children()) {
		if (entry.kind() === 'pair_pattern') {
			const key = entry.field('key');
			const newName = key && RENAMES.get(key.text());

			if (key?.kind() === 'property_identifier' && newName) {
				ctx.edits.push(key.replace(newName));
			}
			continue;
		}

		if (entry.kind() !== 'shorthand_property_identifier_pattern') continue;

		const oldName = entry.text();
		const newName = RENAMES.get(oldName);
		if (!newName) continue;

		if (canRenameBinding(ctx, oldName, newName)) {
			ctx.edits.push(entry.replace(newName));
			renameReferences(ctx, oldName, newName);
		} else {
			ctx.edits.push(entry.replace(`${newName}: ${oldName}`));
		}
	}
}

/**
 * Renames `sqlite.DatabaseSync` (value or TypeScript type) for a binding that
 * holds the whole `node:sqlite` module.
 */
function migrateNamespace(
	root: SgRoot<Js>,
	ctx: Context,
	local: SgNode<Js>,
): void {
	const namespace = local.text();

	if (findNames(ctx, namespace).some(isBindingPosition)) {
		warn(
			root,
			local,
			`\`${namespace}\` is redeclared in this file; review \`${namespace}.DatabaseSync\` and \`${namespace}.StatementSync\` manually (DEP0210, DEP0211).`,
		);
		return;
	}

	const namespaceRegex = `^${namespace}$`;

	const members = ctx.rootNode.findAll({
		rule: {
			kind: 'member_expression',
			all: [
				{ has: { field: 'object', kind: 'identifier', regex: namespaceRegex } },
				{ has: { field: 'property', regex: RENAME_REGEX } },
			],
		},
	});

	for (const member of members) {
		renameProperty(ctx, member.field('property'));
	}

	const types = ctx.rootNode.findAll({
		rule: {
			kind: NESTED_TYPE_KIND,
			all: [
				{ has: { field: 'module', kind: 'identifier', regex: namespaceRegex } },
				{ has: { field: 'name', regex: RENAME_REGEX } },
			],
		} as Rule<Js>,
	});

	for (const type of types) {
		renameProperty(ctx, type.field('name'));
	}
}

function renameProperty(ctx: Context, property: SgNode<Js> | null): void {
	const newName = property && RENAMES.get(property.text());

	if (property && newName) {
		ctx.edits.push(property.replace(newName));
	}
}

/**
 * A binding can be renamed in place only when the new name is unused in the
 * file and the old name is not declared anywhere else, so that no reference
 * can be captured or shadowed.
 */
function canRenameBinding(
	ctx: Context,
	oldName: string,
	newName: string,
): boolean {
	const newNameUsed = ctx.rootNode
		.findAll({ rule: NAME_RULE })
		.some((node) => node.text() === newName && !isQualifiedTypeName(node));

	if (newNameUsed) return false;

	return !findNames(ctx, oldName).some(isBindingPosition);
}

function renameReferences(
	ctx: Context,
	oldName: string,
	newName: string,
): void {
	for (const node of findNames(ctx, oldName)) {
		if (node.kind() === 'shorthand_property_identifier') {
			ctx.edits.push(node.replace(`${oldName}: ${newName}`));
			continue;
		}

		const parent = node.parent();

		if (parent?.kind() === 'export_specifier') {
			// `export { X as DatabaseSync }`: the alias is a public name.
			if (isField(parent, 'alias', node)) continue;

			ctx.edits.push(
				node.replace(
					parent.field('alias') ? newName : `${newName} as ${oldName}`,
				),
			);
			continue;
		}

		ctx.edits.push(node.replace(newName));
	}
}

/**
 * Identifiers, type identifiers, and shorthand properties named `name`,
 * outside the `node:sqlite` statements themselves.
 */
function findNames(ctx: Context, name: string): SgNode<Js>[] {
	return ctx.rootNode
		.findAll({
			rule: { ...NAME_RULE, regex: `^${name}$` },
		})
		.filter(
			(node) =>
				!isQualifiedTypeName(node) &&
				!ctx.ownRanges.some((range) => isWithin(node.range(), range)),
		);
}

/** `Other.DatabaseSync` used as a TypeScript type. */
function isQualifiedTypeName(node: SgNode<Js>): boolean {
	const parent = node.parent();

	return parent?.kind() === NESTED_TYPE_KIND && isField(parent, 'name', node);
}

/**
 * Whether the node declares a binding (variable, parameter, function, class,
 * type, import) instead of referencing one. Re-exports from other modules are
 * treated as bindings too, because they must never be renamed.
 */
function isBindingPosition(node: SgNode<Js>): boolean {
	if (node.kind() === 'shorthand_property_identifier_pattern') return true;

	const parent = node.parent();
	if (!parent) return false;

	const parentKind = parent.kind();

	if (NAMED_DECLARATIONS.has(parentKind)) return isField(parent, 'name', node);

	if (BINDING_PARENTS.has(parentKind)) return true;

	if (parentKind in BINDING_FIELDS) {
		return isField(parent, BINDING_FIELDS[parentKind], node);
	}

	if (parentKind === 'export_specifier') {
		return Boolean(parent.parent()?.parent()?.field('source'));
	}

	return false;
}

function isField(parent: SgNode<Js>, field: string, node: SgNode<Js>): boolean {
	// biome-ignore lint/suspicious/noExplicitAny: field names vary by node kind.
	const child = parent.field(field as any) as SgNode<Js> | null;

	return Boolean(child && isSameRange(child.range(), node.range()));
}

function isSameRange(a: Range, b: Range): boolean {
	return a.start.index === b.start.index && a.end.index === b.end.index;
}

function isWithin(inner: Range, outer: Range): boolean {
	return (
		inner.start.index >= outer.start.index && inner.end.index <= outer.end.index
	);
}

function warn(root: SgRoot<Js>, node: SgNode<Js>, message: string): void {
	const { start } = node.range();

	console.warn(
		`${root.filename()}:${start.line + 1}:${start.column + 1}: ${message}`,
	);
}

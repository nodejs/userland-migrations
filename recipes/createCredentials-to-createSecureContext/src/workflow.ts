import { EOL } from 'node:os';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import {
	getNodeImportCalls,
	getNodeImportStatements,
} from '@nodejs/codemod-utils/ast-grep/import-statement';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import type { SgRoot, Edit, SgNode } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

type SourceHandler = (statement: SgNode<Js>, rootNode: SgRoot<Js>) => Edit[];

type SourceTuple = [SgNode<Js>[], SourceHandler];

const newImportFunction = 'createSecureContext';
const newImportModule = 'node:tls';
const oldFunctionName = 'createCredentials';
const oldImportModule = 'node:crypto';
const newNamespace = 'tls';

function replaceUsagesForResolvedPath(
	rootNode: SgRoot<Js>,
	resolvedPath: string,
): Edit[] {
	// Namespace/member usage e.g., crypto.createCredentials or ns.createCredentials
	if (resolvedPath.includes('.')) {
		const [object, property] = resolvedPath.split('.');
		const usages = rootNode.root().findAll({
			rule: {
				kind: 'call_expression',
				has: {
					field: 'function',
					kind: 'member_expression',
					all: [
						{ has: { field: 'object', regex: `^${object}$` } },
						{ has: { field: 'property', regex: `^${property}$` } },
					],
				},
			},
		});

		return usages
			.map((u) => u.field('function'))
			.filter((f): f is SgNode<Js> => Boolean(f))
			.map((f) => f.replace(`${newNamespace}.${newImportFunction}`));
	}

	// Destructured identifier usage
	// If alias was used, resolvedPath will not equal oldFunctionName; in that case we do not touch call sites
	if (resolvedPath === oldFunctionName) {
		const usages = rootNode.root().findAll({
			rule: {
				kind: 'call_expression',
				has: {
					field: 'function',
					kind: 'identifier',
					regex: `^${oldFunctionName}$`,
				},
			},
		});

		return usages
			.map((usage) => usage.field('function'))
			.filter((id): id is SgNode<Js> => Boolean(id))
			.map((id) => id.replace(newImportFunction));
	}

	// Aliased destructured identifier => keep usages intact
	return [];
}

function handleRequire(statement: SgNode<Js>, rootNode: SgRoot<Js>): Edit[] {
	const idNode = statement.child(0);
	const declaration = statement.parent();

	if (!idNode || !declaration) return [];

	const resolved = resolveBindingPath(statement, `$.${oldFunctionName}`);
	if (!resolved) return [];

	const usageEdits = replaceUsagesForResolvedPath(rootNode, resolved);

	if (idNode.kind() === 'identifier') {
		// Namespace require: replace import and usages
		return [
			...usageEdits,
			declaration.replace(
				`const ${newNamespace} = require('${newImportModule}');`,
			),
		];
	}

	if (idNode.kind() === 'object_pattern') {
		const isAliased = resolved !== oldFunctionName;
		const relevantSpecifiers = idNode
			.children()
			.filter(
				(child) =>
					child.kind() === 'pair_pattern' ||
					child.kind() === 'shorthand_property_identifier_pattern',
			);

		const otherSpecifiers = relevantSpecifiers.filter((spec) => {
			if (spec.kind() === 'pair_pattern') {
				const key = spec.field('key');
				return key?.text() !== oldFunctionName;
			}
			// shorthand
			return spec.text() !== oldFunctionName;
		});

		const newImportSpecifier = isAliased
			? `{ ${newImportFunction}: ${resolved} }`
			: `{ ${newImportFunction} }`;
		const newImportStatement = `const ${newImportSpecifier} = require('${newImportModule}');`;

		if (otherSpecifiers.length > 0) {
			const othersText = otherSpecifiers.map((s) => s.text()).join(', ');
			const modifiedOldImport = `const { ${othersText} } = require('${oldImportModule}');`;
			return [
				...usageEdits,
				declaration.replace(`${modifiedOldImport}${EOL}${newImportStatement}`),
			];
		}

		return [...usageEdits, declaration.replace(newImportStatement)];
	}

	return [];
}

function handleStaticImport(
	statement: SgNode<Js>,
	rootNode: SgRoot<Js>,
): Edit[] {
	const importClause = statement.child(1);
	if (importClause?.kind() !== 'import_clause') return [];

	const content = importClause.child(0);
	if (!content) return [];

	const resolved = resolveBindingPath(statement, `$.${oldFunctionName}`);
	if (!resolved) return [];

	const usageEdits = replaceUsagesForResolvedPath(rootNode, resolved);

	// Namespace imports: import * as ns from '...'
	if (content.kind() === 'namespace_import') {
		return [
			...usageEdits,
			statement.replace(
				`import * as ${newNamespace} from '${newImportModule}';`,
			),
		];
	}

	// Named imports: import { x } from '...'
	if (content.kind() === 'named_imports') {
		const specs = content
			.children()
			.filter((c) => c.kind() === 'import_specifier');
		const otherSpecs = specs.filter(
			(s) => s.field('name')?.text() !== oldFunctionName,
		);

		const isAliased = resolved !== oldFunctionName;
		const newSpec = isAliased
			? `{ ${newImportFunction} as ${resolved} }`
			: `{ ${newImportFunction} }`;
		const newStmt = `import ${newSpec} from '${newImportModule}';`;

		return [
			...usageEdits,
			otherSpecs.length
				? statement.replace(
						`import { ${otherSpecs.map((s) => s.text()).join(', ')} } from '${oldImportModule}';${EOL}${newStmt}`,
					)
				: statement.replace(newStmt),
		];
	}

	return [];
}

function handleDynamicImport(
	statement: SgNode<Js>,
	rootNode: SgRoot<Js>,
): Edit[] {
	const valueNode = statement.field('value');
	const idNode = statement.child(0);
	const declaration = statement.parent();

	// must be `const ... = await import(...)` and have a parent declaration
	if (valueNode?.kind() !== 'await_expression' || !declaration) return [];

	const resolved = resolveBindingPath(statement, `$.${oldFunctionName}`);
	if (!resolved) return [];

	const usageEdits = replaceUsagesForResolvedPath(rootNode, resolved);

	// Case 1: `const ns = await import(...)`
	if (idNode?.kind() === 'identifier') {
		return [
			...usageEdits,
			declaration.replace(
				`const ${newNamespace} = await import('${newImportModule}');`,
			),
		];
	}

	// Case 2: `const { ... } = await import(...)`
	if (idNode?.kind() === 'object_pattern') {
		const isAliased = resolved !== oldFunctionName;
		const specifiers = idNode
			.children()
			.filter(
				(c) =>
					c.kind() === 'pair_pattern' ||
					c.kind() === 'shorthand_property_identifier_pattern',
			);

		const otherSpecifiers = specifiers.filter((s) => {
			if (s.kind() === 'pair_pattern') {
				const key = s.field('key');
				return key?.text() !== oldFunctionName;
			}
			return s.text() !== oldFunctionName;
		});

		const newImportSpecifier = isAliased
			? `{ ${newImportFunction}: ${resolved} }`
			: `{ ${newImportFunction} }`;
		const newImportStmt = `const ${newImportSpecifier} = await import('${newImportModule}');`;

		return [
			...usageEdits,
			otherSpecifiers.length
				? declaration.replace(
						`const { ${otherSpecifiers.map((s) => s.text()).join(', ')} } = await import('${oldImportModule}');${EOL}${newImportStmt}`,
					)
				: declaration.replace(newImportStmt),
		];
	}

	return [];
}

export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const allEdits: Edit[] = [];
	const sources: SourceTuple[] = [
		[getNodeRequireCalls(root, 'crypto'), handleRequire],
		[getNodeImportStatements(root, 'crypto'), handleStaticImport],
		[getNodeImportCalls(root, 'crypto'), handleDynamicImport],
	];

	for (const [nodes, handler] of sources) {
		// if no nodes found, skip to next source type
		if (!nodes.length) continue;

		for (const node of nodes) {
			const edits = handler(node, root);

			if (edits.length) {
				allEdits.push(...edits);
			}
		}
	}

	if (!allEdits.length) return null;

	return rootNode.commitEdits(allEdits);
}

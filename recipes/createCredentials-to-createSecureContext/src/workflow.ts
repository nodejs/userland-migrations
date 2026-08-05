import { EOL } from 'node:os';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { useMetricAtom } from 'codemod:metrics';
import type { Codemod, SgRoot, Edit, SgNode } from 'codemod:ast-grep';
import type Js from 'codemod:ast-grep/langs/javascript';
import { getNodeImportCalls, getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';

type SourceHandler = (statement: SgNode<Js>, rootNode: SgRoot<Js>) => Edit[];

type SourceTuple = [SgNode<Js>[], SourceHandler, SourceKind];
type SourceKind = 'require' | 'static-import' | 'dynamic-import';

const newImportFunction = 'createSecureContext';
const newImportModule = 'node:tls';
const oldFunctionName = 'createCredentials';
const oldImportModule = 'node:crypto';
const newNamespace = 'tls';

const importMetric = useMetricAtom('crypto-createcredentials-imports');
const usageMetric = useMetricAtom('crypto-createcredentials-usages');
const filesMetric = useMetricAtom('crypto-createcredentials-files');

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

		const edits = usages
			.map((u) => u.field('function'))
			.filter((f): f is SgNode<Js> => Boolean(f))
			.map((f) => f.replace(`${newNamespace}.${newImportFunction}`));

		if (edits.length) usageMetric.increment({ kind: 'member-expression', count: edits.length.toString() });

		return edits;
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

		const edits = usages
			.map((usage) => usage.field('function'))
			.filter((id): id is SgNode<Js> => Boolean(id))
			.map((id) => id.replace(newImportFunction));

		if (edits.length) usageMetric.increment({ kind: 'identifier', count: edits.length.toString() });

		return edits;
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
		importMetric.increment({ source: 'require', shape: 'namespace' });
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

		importMetric.increment({
			source: 'require',
			shape: isAliased ? 'named-aliased' : 'named',
		});

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
		importMetric.increment({ source: 'static-import', shape: 'namespace' });
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

		importMetric.increment({
			source: 'static-import',
			shape: isAliased ? 'named-aliased' : 'named',
		});

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
		importMetric.increment({ source: 'dynamic-import', shape: 'namespace' });
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

		importMetric.increment({
			source: 'dynamic-import',
			shape: isAliased ? 'named-aliased' : 'named',
		});

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

const transform: Codemod<Js> = async (root) => {
	const rootNode = root.root();
	const allEdits: Edit[] = [];
	const sources: SourceTuple[] = [
		[getNodeRequireCalls(root, 'crypto'), handleRequire, 'require'],
		[getNodeImportStatements(root, 'crypto'), handleStaticImport, 'static-import'],
		[getNodeImportCalls(root, 'crypto'), handleDynamicImport, 'dynamic-import'],
	];

	let sawSource = false;

	for (const [nodes, handler] of sources) {
		// if no nodes found, skip to next source type
		if (!nodes.length) continue;

		sawSource = true;

		for (const node of nodes) {
			const edits = handler(node, root);

			if (edits.length) {
				allEdits.push(...edits);
			}
		}
	}

	if (sawSource) filesMetric.increment({ status: 'has-crypto-import' });

	if (!allEdits.length) {
		filesMetric.increment({ status: 'no-changes' });
		return null;
	}

	filesMetric.increment({ status: 'migrated' });

	return rootNode.commitEdits(allEdits);
}

export default transform;

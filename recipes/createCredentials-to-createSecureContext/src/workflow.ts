import { EOL } from 'node:os';
import type { SgRoot, Edit, SgNode, Kinds, TypesMap } from "@codemod.com/jssg-types/main";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { getNodeImportCalls, getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";

const newImportFunction = 'createSecureContext'
const newImportModule = 'node:tls'
const oldFunctionName = 'createCredentials';
const oldImportModule = 'node:crypto'

function handleNamespaceImport(
	rootNode: SgRoot,
	localNamespace: string,
	declaration: SgNode<TypesMap, Kinds<TypesMap>>,
	importType: 'require' | 'static' | 'dynamic-await'
): Edit[] {
	const allEdits: Edit[] = [];
	const newNamespace = 'tls';

	const usages = rootNode.root().findAll({
		rule: {
			kind: 'call_expression',
			has: {
				field: 'function',
				kind: 'member_expression',
				all: [
					{ has: { field: 'object', regex: `^${localNamespace}$` } },
					{ has: { field: 'property', regex: `^${oldFunctionName}$` } }
				]
			}
		}
	});

	if (usages.length === 0) {
		return [];
	}

	for (const usage of usages) {
		const func = usage.field('function');
		if (func) {
			allEdits.push(func.replace(`${newNamespace}.${newImportFunction}`));
		}
	}

	let newImportStatement = '';
	switch (importType) {
		case 'require':
			newImportStatement = `const ${newNamespace} = require('${newImportModule}');`;
			break;
		case 'static':
			newImportStatement = `import * as ${newNamespace} from '${newImportModule}';`;
			break;
		case 'dynamic-await':
			newImportStatement = `const ${newNamespace} = await import('${newImportModule}');`;
			break;
	}

	allEdits.push(declaration.replace(newImportStatement));

	return allEdits;
}

function handleDestructuredImport(
	rootNode: SgRoot,
	idNode: SgNode<TypesMap, Kinds<TypesMap>>,
	declaration: SgNode<TypesMap, Kinds<TypesMap>>,
	importType: 'require' | 'static' | 'dynamic-await'
): Edit[] {
	let localFunctionName: string | null = null;
	let targetSpecifierNode: SgNode | null = null;
	let isAliased = false;

	const relevantSpecifiers = idNode.children().filter(
		child => ['pair_pattern', 'shorthand_property_identifier_pattern', 'import_specifier'].includes(child.kind() as string)
	);

	for (const spec of relevantSpecifiers) {
		let keyNode, aliasNode;

		if (spec.kind() === 'import_specifier') {
			keyNode = spec.field('name');
			aliasNode = spec.field('alias');
		} else if (spec.kind() === 'pair_pattern') {
			keyNode = spec.field('key');
			aliasNode = spec.field('value');
		} else {
			keyNode = spec;
		}

		if (keyNode?.text() === oldFunctionName) {
			targetSpecifierNode = spec;
			isAliased = Boolean(aliasNode);
			localFunctionName = isAliased ? aliasNode!.text() : keyNode!.text();
			break;
		}
	}

	if (localFunctionName && targetSpecifierNode) {
		const allEdits: Edit[] = [];

		if (!isAliased) {
			const usageEdits = findAndReplaceUsages(rootNode, localFunctionName, newImportFunction);
			allEdits.push(...usageEdits);
		}

		const aliasSeparator = importType === 'static' ? ' as' : ':';
		const newImportSpecifier = isAliased
			? `{ ${newImportFunction}${aliasSeparator} ${localFunctionName} }`
			: `{ ${newImportFunction} }`;

		let newImportStatement = '';
		switch (importType) {
			case 'require':
				newImportStatement = `const ${newImportSpecifier} = require('${newImportModule}');`;
				break;
			case 'static':
				newImportStatement = `import ${newImportSpecifier} from '${newImportModule}';`;
				break;
			case 'dynamic-await':
				newImportStatement = `const ${newImportSpecifier} = await import('${newImportModule}');`;
				break;
		}

		const otherSpecifiers = relevantSpecifiers.filter(s => s !== targetSpecifierNode);
		if (otherSpecifiers.length > 0) {
			const otherSpecifiersText = otherSpecifiers.map(s => s.text()).join(', ');
			let modifiedOldImport = '';
			switch (importType) {
				case 'require':
					modifiedOldImport = `const { ${otherSpecifiersText} } = require('${oldImportModule}');`;
					break;
				case 'static':
					modifiedOldImport = `import { ${otherSpecifiersText} } from '${oldImportModule}';`;
					break;
				case 'dynamic-await':
					modifiedOldImport = `const { ${otherSpecifiersText} } = await import('${oldImportModule}');`;
					break;
			}
			const replacementText = `${modifiedOldImport}${EOL}${newImportStatement}`;
			allEdits.push(declaration.replace(replacementText));
		} else {
			allEdits.push(declaration.replace(newImportStatement));
		}

		return allEdits;
	}

	return [];
}

function findAndReplaceUsages(
	rootNode: SgRoot,
	localFunctionName: string,
	newFunctionName: string,
	object: string | null = null
): Edit[] {
	const edits: Edit[] = [];

	if (object) {
		const usages = rootNode.root().findAll({
			rule: {
				kind: 'call_expression',
				has: {
					field: 'function',
					kind: 'member_expression',
					all: [
						{ has: { field: 'object', regex: `^${object}$` } },
						{ has: { field: 'property', regex: `^${localFunctionName}$` } }
					]
				}
			}
		});

		for (const usage of usages) {
			const memberExpressionNode = usage.field('function');
			const propertyNode = memberExpressionNode?.field('property');
			if (propertyNode) {
				edits.push(propertyNode.replace(newFunctionName));
			}
		}
	} else {
		const usages = rootNode.root().findAll({
			rule: {
				kind: 'call_expression',
				has: { field: 'function', kind: 'identifier', regex: `^${localFunctionName}$` },
			},
		});

		for (const usage of usages) {
			const functionNode = usage.field('function');
			if (functionNode) {
				edits.push(functionNode.replace(newFunctionName));
			}
		}
	}
	return edits;
}

function handleRequire(
	statement: SgNode<TypesMap, Kinds<TypesMap>>,
	rootNode: SgRoot,
): Edit[] {
	const idNode = statement.child(0);
	const declaration = statement.parent();

	if (!idNode || !declaration) {
		return [];
	}

	// Handle Namespace Imports: const crypto = require('...')
	if (idNode.kind() === 'identifier') {
		const localNamespace = idNode.text();
		return handleNamespaceImport(rootNode, localNamespace, declaration, 'require');
	}

	// Handle Destructured Imports: const { ... } = require('...')
	if (idNode.kind() === 'object_pattern') {
		return handleDestructuredImport(rootNode, idNode, declaration, 'require');
	}

	return [];
}
function handleStaticImport(
	statement: SgNode<TypesMap, Kinds<TypesMap>>,
	rootNode: SgRoot,
): Edit[] {

	const modulePathNode = statement.field('source');
	const importClause = statement.child(1);

	if (importClause?.kind() !== 'import_clause' || !modulePathNode) {
		return [];
	}

	const clauseContent = importClause.child(0);

	if (!clauseContent) {
		return [];
	}

	// Handle Namespace Imports: import * as crypto from '...'
	if (clauseContent.kind() === 'namespace_import') {
		const localNamespace = clauseContent.find({ rule: { kind: 'identifier' } })?.text();
		const allEdits: Edit[] = [];

		const usages = rootNode.root().findAll({
			rule: {
				kind: 'call_expression',
				has: {
					field: 'function',
					kind: 'member_expression',
					all: [
						{ has: { field: 'object', regex: `^${localNamespace}$` } },
						{ has: { field: 'property', regex: `^${oldFunctionName}$` } }
					]
				}
			}
		});

		if (usages.length > 0) {
			const newNamespace = 'tls';

			for (const usage of usages) {
				const func = usage.field('function');
				if (func) {
					allEdits.push(func.replace(`${newNamespace}.${newImportFunction}`));
				}
			}

			const newImportStatement = `import * as ${newNamespace} from '${newImportModule}';`;
			allEdits.push(statement.replace(newImportStatement));

			return allEdits;
		}
	}

	// Handle Named Imports: import { ... } from '...'
	if (clauseContent.kind() === 'named_imports') {
		const namedImportsNode = clauseContent;
		let localFunctionName: string | null = null;
		let targetSpecifierNode: SgNode | null = null;
		let isAliased = false;

		const relevantSpecifiers = namedImportsNode.children().filter(
			child => child.kind() === 'import_specifier'
		);

		for (const spec of relevantSpecifiers) {
			const nameNode = spec.field('name');
			const aliasNode = spec.field('alias');


			if (nameNode?.text() === oldFunctionName) {
				targetSpecifierNode = spec;
				isAliased = Boolean(aliasNode);
				localFunctionName = isAliased ? aliasNode!.text() : nameNode!.text();
				break;
			}
		}

		if (localFunctionName && targetSpecifierNode) {
			const allEdits: Edit[] = [];
			const declaration = statement;

			if (!isAliased) {
				const usageEdits = findAndReplaceUsages(rootNode, localFunctionName, newImportFunction);
				allEdits.push(...usageEdits);
			} else {
			}

			const newImportSpecifier = isAliased
				? `{ ${newImportFunction} as ${localFunctionName} }`
				: `{ ${newImportFunction} }`;
			const newImportStatement = `import ${newImportSpecifier} from '${newImportModule}';`;

			const otherSpecifiers = relevantSpecifiers.filter(s => s !== targetSpecifierNode);
			if (otherSpecifiers.length > 0) {
				const modifiedOldImport = `import { ${otherSpecifiers.map(s => s.text()).join(', ')} } from '${oldImportModule}';`;
				const replacementText = `${modifiedOldImport}${EOL}${newImportStatement}`;
				allEdits.push(declaration.replace(replacementText));
			} else {
				allEdits.push(declaration.replace(newImportStatement));
			}

			return allEdits;
		}
	}

	return [];
}

function handleDynamicImport(
	statement: SgNode<TypesMap, Kinds<TypesMap>>,
	rootNode: SgRoot,
): Edit[] {

	const valueNode = statement.field('value');
	const idNode = statement.child(0);
	const declaration = statement.parent();

	if (valueNode?.kind() === 'call_expression' && idNode?.kind() === 'identifier') {
		const functionNode = valueNode.field('function');
		const isThenCall = functionNode?.kind() === 'member_expression' && functionNode.field('property')?.text() === 'then';
		const awaitNode = functionNode?.field('object')?.find({ rule: { kind: 'await_expression' } });

		const importModuleStringNode = awaitNode?.find({
			rule: {
				kind: 'string',
				has: { kind: 'string_fragment', regex: `^${oldImportModule}$` }
			}
		});

		if (isThenCall && importModuleStringNode) {
			const allEdits: Edit[] = [];

			const usageEdits = findAndReplaceUsages(rootNode, idNode.text(), newImportFunction);

			allEdits.push(...usageEdits);
			allEdits.push(idNode.replace(newImportFunction));
			allEdits.push(importModuleStringNode.replace(`'${newImportModule}'`));

			const thenCallback = valueNode.field('arguments')?.child(0);
			const callbackBody = thenCallback?.field('body');
			if (callbackBody?.kind() === 'member_expression') {
				const propertyNode = callbackBody.field('property');
				if (propertyNode?.text() === oldFunctionName) {
					allEdits.push(propertyNode.replace(newImportFunction));
				}
			}

			return allEdits;
		}
	}

	if (valueNode?.kind() === 'await_expression') {
		if (!declaration) {
			return [];
		}

		if (idNode?.kind() === 'identifier') {
			const localNamespace = idNode.text();
			const allEdits: Edit[] = [];

			const usages = rootNode.root().findAll({
				rule: {
					kind: 'call_expression',
					has: {
						field: 'function',
						kind: 'member_expression',
						all: [
							{ has: { field: 'object', regex: `^${localNamespace}$` } },
							{ has: { field: 'property', regex: `^${oldFunctionName}$` } }
						]
					}
				}
			});

			if (usages.length > 0) {
				const newNamespace = 'tls';

				for (const usage of usages) {
					const func = usage.field('function');
					if (func) {
						allEdits.push(func.replace(`${newNamespace}.${newImportFunction}`));
					}
				}

				const newImportStatement = `const ${newNamespace} = await import('${newImportModule}');`;
				allEdits.push(declaration.replace(newImportStatement));

				return allEdits;
			}
		}

		if (idNode?.kind() === 'object_pattern') {
			let localFunctionName: string | null = null;
			let targetSpecifierNode: SgNode | null = null;
			let isAliased = false;

			const relevantSpecifiers = idNode.children().filter(
				child => child.kind() === 'pair_pattern' || child.kind() === 'shorthand_property_identifier_pattern'
			);

			for (const spec of relevantSpecifiers) {
				const key = spec.kind() === 'pair_pattern' ? spec.field('key') : spec;
				if (key?.text() === oldFunctionName) {
					targetSpecifierNode = spec;
					isAliased = spec.kind() === 'pair_pattern';
					localFunctionName = isAliased ? spec.field('value')!.text() : key.text();
					break;
				}
			}

			if (localFunctionName && targetSpecifierNode) {
				const allEdits: Edit[] = [];

				if (!isAliased) {
					const usageEdits = findAndReplaceUsages(rootNode, localFunctionName, newImportFunction);
					allEdits.push(...usageEdits);
				} else {
				}

				const newImportSpecifier = isAliased
					? `{ ${newImportFunction}: ${localFunctionName} }`
					: `{ ${newImportFunction} }`;
				const newImportStatement = `const ${newImportSpecifier} = await import('${newImportModule}');`;

				const otherSpecifiers = relevantSpecifiers.filter(s => s !== targetSpecifierNode);
				if (otherSpecifiers.length > 0) {
					const modifiedOldImport = `const { ${otherSpecifiers.map(s => s.text()).join(', ')} } = await import('${oldImportModule}');`;
					const replacementText = `${modifiedOldImport}${EOL}${newImportStatement}`;
					allEdits.push(declaration.replace(replacementText));
				} else {
					allEdits.push(declaration.replace(newImportStatement));
				}

				return allEdits;
			}
		}
	}

	return [];
}

export default function transform(root: SgRoot): string | null {
	const rootNode = root.root();
	const allEdits: Edit[] = [];
	let wasTransformed = false;

	// @ts-ignore
	const requireImports = getNodeRequireCalls(root, 'crypto');
	// @ts-ignore
	const staticImports = getNodeImportStatements(root, 'crypto');
	// @ts-ignore
	const dynamicImports = getNodeImportCalls(root, 'crypto');

	for (const requireCall of requireImports) {
		const edits = handleRequire(requireCall, root);
		if (edits.length > 0) {
			wasTransformed = true;
			allEdits.push(...edits);
		}
	}

	for (const staticImport of staticImports) {
		const edits = handleStaticImport(staticImport, root);
		if (edits.length > 0) {
			wasTransformed = true;
			allEdits.push(...edits);
		}
	}

	for (const dynamicImport of dynamicImports) {
		const edits = handleDynamicImport(dynamicImport, root);
		if (edits.length > 0) {
			wasTransformed = true;
			allEdits.push(...edits);
		}
	}

	return wasTransformed ? rootNode.commitEdits(allEdits) : null;
}

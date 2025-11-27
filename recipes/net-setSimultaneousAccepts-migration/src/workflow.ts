import {
	getNodeImportStatements,
	getNodeImportCalls,
} from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import type { SgRoot, Edit, Range, SgNode } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

/**
 * Transform function that removes deprecated net._setSimultaneousAccepts() calls
 *
 * Handles:
 * 1. net._setSimultaneousAccepts(true) → removed
 * 2. net._setSimultaneousAccepts(false) → removed
 * 3. Works with both CommonJS (require) and ESM (import) syntax
 * 4. Handles aliased imports/requires
 * 5. Removes unused variables/properties passed to the function
 *
 * Note: This was an internal API (DEP0121) that reached End-of-Life in Node.js v24.0.0
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	const netImportStatements = getAllNetImportStatements(root);
	if (netImportStatements.length === 0) return null;

	for (const statement of netImportStatements) {
		processNetImportStatement(rootNode, statement, linesToRemove, edits);
	}

	if (edits.length === 0 && linesToRemove.length === 0) return null;

	return applyTransformations(rootNode, edits, linesToRemove);
}

/**
 * Collects all import/require statements for 'node:net'
 */
function getAllNetImportStatements(root: SgRoot<Js>): SgNode<Js>[] {
	return [
		...getNodeImportStatements(root, 'node:net'),
		...getNodeImportCalls(root, 'node:net'),
		...getNodeRequireCalls(root, 'node:net'),
	];
}

/**
 * Processes a single net import statement and finds all _setSimultaneousAccepts calls
 */
function processNetImportStatement(
	rootNode: SgNode<Js>,
	statementNode: SgNode<Js>,
	linesToRemove: Range[],
	edits: Edit[]
): void {
	const bindingPath = resolveBindingPath(statementNode, '$');
	if (!bindingPath) return;

	const callExpressions = findSetSimultaneousAcceptsCalls(rootNode, bindingPath);

	for (const callNode of callExpressions) {
		const argNode = callNode.getMatch('ARG');
		
		if (argNode) {
			handleCallArgument(rootNode, argNode, linesToRemove);
		}

		removeCallExpression(callNode, linesToRemove, edits);
	}
}

/**
 * Finds all _setSimultaneousAccepts() call expressions
 */
function findSetSimultaneousAcceptsCalls(
	rootNode: SgNode<Js>,
	bindingPath: string
): SgNode<Js>[] {
	return rootNode.findAll({
		rule: {
			pattern: `${bindingPath}._setSimultaneousAccepts($ARG)`,
		},
	});
}

/**
 * Handles the argument passed to _setSimultaneousAccepts()
 * If it's a member expression or identifier that's only used here, marks it for removal
 */
function handleCallArgument(
	rootNode: SgNode<Js>,
	argNode: SgNode<Js>,
	linesToRemove: Range[]
): void {
	const argKind = argNode.kind();

	if (argKind === 'member_expression') {
		handleMemberExpressionArgument(rootNode, argNode, linesToRemove);
	} else if (argKind === 'identifier') {
		handleIdentifierArgument(rootNode, argNode, linesToRemove);
	}
}

/**
 * Handles member expression arguments (e.g., config.flag)
 * Removes the property from the object if it's only used in this call
 */
function handleMemberExpressionArgument(
	rootNode: SgNode<Js>,
	argNode: SgNode<Js>,
	linesToRemove: Range[]
): void {
	const objectNode = argNode.child(0);
	const propertyNode = argNode.child(2);
	
	if (!objectNode || !propertyNode) return;

	const objectName = objectNode.text();
	const propertyName = propertyNode.text();
	
	const propertyRefs = rootNode.findAll({
		rule: { pattern: `${objectName}.${propertyName}` },
	});
	
	// Only remove if this is the only reference
	if (propertyRefs.length === 1) {
		removePropertyFromObjectDeclaration(rootNode, objectName, propertyName, linesToRemove);
	}
}

/**
 * Removes a property from an object literal declaration
 */
function removePropertyFromObjectDeclaration(
	rootNode: SgNode<Js>,
	objectName: string,
	propertyName: string,
	linesToRemove: Range[]
): void {
	const objDeclarations = rootNode.findAll({
		rule: {
			any: [
				{ pattern: `const ${objectName} = $_` },
				{ pattern: `let ${objectName} = $_` },
				{ pattern: `var ${objectName} = $_` },
			],
		},
	});
	
	for (const objDecl of objDeclarations) {
		const objectLiterals = objDecl.findAll({ rule: { kind: 'object' } });
		
		for (const obj of objectLiterals) {
			const pairs = obj.findAll({ rule: { kind: 'pair' } });
			
			for (const pair of pairs) {
				const key = pair.child(0);
				if (key?.text() === propertyName) {
					const rangeWithComma = expandRangeToIncludeTrailingComma(
						pair.range(),
						rootNode.text()
					);
					linesToRemove.push(rangeWithComma);
				}
			}
		}
	}
}

/**
 * Expands a range to include a trailing comma if present
 */
function expandRangeToIncludeTrailingComma(range: Range, sourceText: string): Range {
	const endPos = range.end.index;
	
	if (endPos < sourceText.length && sourceText[endPos] === ',') {
		return {
			start: range.start,
			end: {
				...range.end,
				index: endPos + 1,
				column: range.end.column + 1
			}
		};
	}
	
	return range;
}

/**
 * Handles identifier arguments (e.g., a variable name)
 * Removes the variable declaration if it's only used in this call
 */
function handleIdentifierArgument(
	rootNode: SgNode<Js>,
	argNode: SgNode<Js>,
	linesToRemove: Range[]
): void {
	const varName = argNode.text().trim();
	
	const allIdentifiers = rootNode.findAll({
		rule: {
			pattern: varName,
			kind: 'identifier',
		},
	});
	
	// Only remove if there are exactly 2 references (declaration + usage)
	if (allIdentifiers.length === 2) {
		removeVariableDeclaration(rootNode, varName, linesToRemove);
	}
}

/**
 * Removes a variable declaration statement
 */
function removeVariableDeclaration(
	rootNode: SgNode<Js>,
	varName: string,
	linesToRemove: Range[]
): void {
	const varDeclarationStatements = rootNode.findAll({
		rule: {
			any: [
				{ pattern: `let ${varName} = $$$_` },
				{ pattern: `const ${varName} = $$$_` },
				{ pattern: `var ${varName} = $$$_` },
			],
		},
	});
	
	for (const declNode of varDeclarationStatements) {
		const topLevelStatement = findTopLevelStatement(declNode);
		if (topLevelStatement) {
			linesToRemove.push(topLevelStatement.range());
		}
	}
}

/**
 * Finds the top-level statement (direct child of program) for a given node
 */
function findTopLevelStatement(node: SgNode<Js>): SgNode<Js> | null {
	let current: SgNode<Js> | null = node;
	
	while (current) {
		const parent = current.parent();
		if (!parent) break;
		
		if (parent.kind() === 'program') {
			return current;
		}
		
		current = parent;
	}
	
	return null;
}

/**
 * Removes the call expression itself
 */
function removeCallExpression(
	callNode: SgNode<Js>,
	linesToRemove: Range[],
	edits: Edit[]
): void {
	const expressionStatement = findParentExpressionStatement(callNode);

	if (expressionStatement) {
		linesToRemove.push(expressionStatement.range());
	} else {
		edits.push(callNode.replace(''));
	}
}

/**
 * Finds the parent expression_statement node
 */
function findParentExpressionStatement(node: SgNode<Js>): SgNode<Js> | null {
	let current: SgNode<Js> | null = node.parent();
	
	while (current && current.kind() !== 'expression_statement') {
		current = current.parent();
	}
	
	return current;
}

/**
 * Applies all edits and line removals to the source code
 */
function applyTransformations(
	rootNode: SgNode<Js>,
	edits: Edit[],
	linesToRemove: Range[]
): string {
	const sourceCode = edits.length > 0 
		? rootNode.commitEdits(edits) 
		: rootNode.text();

	return linesToRemove.length > 0
		? removeLines(sourceCode, linesToRemove)
		: sourceCode;
}
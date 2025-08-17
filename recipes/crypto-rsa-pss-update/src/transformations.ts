import type { SgNode, Edit } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";
import { getValidText, getValueNodeFromPair, isValidHashKey, getOptionsFromCalls } from "./helpers";
import { isRsaPssType } from "./rsa-pss-validation";
import { HASH_MAPPINGS, IDENTIFIER_REGEX } from "./constants";

/**
 * Transforms a hash property pair to the new algorithm naming
 */
export function transformHashProperty(pair: SgNode<JS>, key: "hash" | "mgf1Hash", value: string): Edit {
	return pair.replace(`${HASH_MAPPINGS[key]}: ${value}`);
}

/**
 * Finds and transforms hash/mgf1Hash properties in an object node
 */
export function transformHashPropertiesInObject(objectNode: SgNode<JS>): Edit[] {
	const edits: Edit[] = [];
	
	const pairs = objectNode.findAll({ rule: { kind: "pair" }});
	
	for (const pair of pairs) {
		const keyNode = pair.find({
			rule: {
				any: [
					{ regex: "hash", kind: "property_identifier" },
					{ regex: "mgf1Hash", kind: "property_identifier" }
				]
			}
		});
		
		const key = getValidText(keyNode);
		if (!isValidHashKey(key)) continue;
		
		const valueNode = getValueNodeFromPair(pair);
		const value = getValidText(valueNode);
		if (!value) continue;
		
		edits.push(transformHashProperty(pair, key, value));
	}
	
	return edits;
}

/**
 * Processes RSA-PSS generateKeyPair calls and transforms deprecated options
 */
export function processRsaPssCalls(rootNode: SgNode<JS>, allCalls: SgNode<JS>[]): Edit[] {
	const edits: Edit[] = [];

	for (const call of allCalls) {
		const typeMatch = call.getMatch("TYPE");
		const optionsMatch = call.getMatch("OPTIONS");

		if (!typeMatch || !optionsMatch) continue;

		// Only process 'rsa-pss' key type
		const typeText = getValidText(typeMatch);
		if (!typeText) continue;

		// Check if this is an 'rsa-pss' type (literal or variable)
		if (!isRsaPssType(rootNode, typeText)) continue;


		// Handle both literal objects and references
		const directObject = optionsMatch.find({
			rule: {
				kind: "object"
			}
		});

		if (directObject) {
			// Transform hash and mgf1Hash properties in direct object
			edits.push(...transformHashPropertiesInObject(directObject));
		} else {
			// Handle variable references and function calls
			edits.push(...processOptionsReference(rootNode, optionsMatch));
		}
		}

	return edits;
}

/**
 * Collects unique spread identifiers from crypto calls
 */
export function collectSpreadIdentifiers(allCalls: SgNode<JS>[]): string[] {
	const spreadNames = getOptionsFromCalls(allCalls)
		.flatMap((optionsMatch: SgNode<JS>) => 
			optionsMatch.findAll({ rule: { kind: "spread_element" }})
				.map((spread: SgNode<JS>) => getValidText(spread.find({ rule: { kind: "identifier" }})))
				.filter(Boolean)
		);
	
	return Array.from(new Set(spreadNames));
}

/**
 * Resolves spread elements like ...hashOptions back to their object declarations
 * and transforms hash/mgf1Hash properties in those objects
 */
export function transformSpreadObjectDeclarations(rootNode: SgNode<JS>, allCalls: SgNode<JS>[]): Edit[] {
	const spreadNames = collectSpreadIdentifiers(allCalls);
	
	return spreadNames.flatMap(spreadName => {
		const objectDeclarations = rootNode.findAll({
			rule: {
				pattern: `const ${spreadName} = { $$$PROPS }`
			}
		});

		return objectDeclarations.flatMap(decl => 
			transformHashPropertiesInObject(decl)
		);
	});
}

/**
 * Generic function to find and transform object declarations based on patterns
 */
export function findAndTransformObjectDeclarations(rootNode: SgNode<JS>, patterns: string[]): Edit[] {
	return patterns.flatMap(pattern => {
		const declarations = rootNode.findAll({ rule: { pattern }});
		return declarations.flatMap(decl => transformHashPropertiesInObject(decl));
	});
}

/**
 * Processes options references (variables and function calls) for RSA-PSS transformations
 */
export function processOptionsReference(rootNode: SgNode<JS>, optionsMatch: SgNode<JS>): Edit[] {
	const optionsText = getValidText(optionsMatch);
	if (!optionsText) return [];
	
	// Case 1: Variable reference (e.g., options)
	if (IDENTIFIER_REGEX.test(optionsText)) {
		return findAndTransformObjectDeclarations(rootNode, [`const ${optionsText} = { $$$PROPS }`]);
	}
	
	// Case 2: Function call (e.g., getKeyOptions())
	if (optionsMatch.find({ rule: { kind: "call_expression" }})) {
		// Extract function name from "functionName()" -> "functionName"
		const functionName = optionsText.replace(/\(\).*$/, '');
		return findAndTransformObjectDeclarations(rootNode, [
			`function ${functionName}() { return { $$$PROPS } }`,
			`const ${functionName} = () => ({ $$$PROPS })`,
			`const ${functionName} = function() { return { $$$PROPS } }`
		]);
	}
	
	return [];
}

/**
 * Processes this.property references for RSA-PSS transformations
 */
export function processThisPropertyReferences(rootNode: SgNode<JS>, allCalls: SgNode<JS>[]): Edit[] {
	const propertyNames = getOptionsFromCalls(allCalls)
		.map((optionsMatch: SgNode<JS>) => getValidText(optionsMatch))
		.filter((text: string | undefined) => text?.startsWith('this.'))
		.map((text: string) => text.replace('this.', ''))
		.filter(Boolean);
	
	const uniquePropertyNames = Array.from(new Set(propertyNames));
	
	return findAndTransformObjectDeclarations(rootNode, 
		uniquePropertyNames.map(propName => `this.${propName} = { $$$PROPS }`)
	);
}
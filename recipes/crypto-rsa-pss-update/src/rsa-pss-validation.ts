import type { SgNode } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";
import { getValidText } from "./helpers";
import { RSA_PSS_LITERAL_REGEX, IDENTIFIER_REGEX } from "./constants";

/**
 * Checks variable declarations for a specific pattern and value
 */
export function checkVariableDeclarations(rootNode: SgNode<JS>, declarationType: "const" | "let", identifier: string, expectedValue: RegExp): boolean {
	const declarations = rootNode.findAll({
		rule: {
			pattern: `${declarationType} ${identifier} = $VALUE`
		}
	});

	return declarations.some(decl => {
		const valueText = getValidText(decl.getMatch("VALUE"));
		return valueText && expectedValue.test(valueText);
	});
}

/**
 * Resolves a variable identifier to its string literal value if it's 'rsa-pss'
 */
export function resolveVariableValue(rootNode: SgNode<JS>, identifier: string): boolean {
	return checkVariableDeclarations(rootNode, "const", identifier, RSA_PSS_LITERAL_REGEX) ||
		   checkVariableDeclarations(rootNode, "let", identifier, RSA_PSS_LITERAL_REGEX);
}

/**
 * Validates if a type text represents 'rsa-pss' (literal or variable)
 */
export function isRsaPssType(rootNode: SgNode<JS>, typeText: string): boolean {
	const isStringLiteral = RSA_PSS_LITERAL_REGEX.test(typeText);
	const isVariableWithRsaPss = IDENTIFIER_REGEX.test(typeText) &&
		resolveVariableValue(rootNode, typeText);
	return isStringLiteral || isVariableWithRsaPss;
}
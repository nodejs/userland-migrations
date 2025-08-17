import type { SgRoot, SgNode, Edit } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";
import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";

// Wrapper functions with better typing for ast-grep compatibility
function safeGetImportStatements(root: SgRoot<JS>, moduleName: string) {
	// @ts-expect-error - Known type incompatibility between ast-grep libraries
	return getNodeImportStatements(root, moduleName) as SgNode<JS>[];
}

function safeGetRequireCalls(root: SgRoot<JS>, moduleName: string) {
	// @ts-expect-error - Known type incompatibility between ast-grep libraries
	return getNodeRequireCalls(root, moduleName) as SgNode<JS>[];
}

function safeResolveBindingPath(stmt: SgNode<JS>, path: string) {
	// @ts-expect-error - Known type incompatibility between ast-grep libraries  
	return resolveBindingPath(stmt, path) as string | undefined;
}

// Constants
const RSA_PSS_REGEX = /^['"]rsa-pss['"]$/;
const IDENTIFIER_REGEX = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
const HASH_MAPPINGS = {
	hash: "hashAlgorithm",
	mgf1Hash: "mgf1HashAlgorithm"
} as const;

/**
 * Transform function that updates deprecated RSA-PSS crypto options.
 *
 * Handles:
 * 1. Property transformations in RSA-PSS key generation options:
 *    - `hash: 'sha256'` → `hashAlgorithm: 'sha256'`
 *    - `mgf1Hash: 'sha1'` → `mgf1HashAlgorithm: 'sha1'`
 * 2. Function call targeting: Only crypto.generateKeyPair() and crypto.generateKeyPairSync()
 * 3. Key type filtering: Only applies to 'rsa-pss' key type (ignores 'rsa', 'ed25519', etc.)
 * 4. Import pattern support: ES6 imports, CommonJS requires, destructuring, aliases, namespace imports
 * 5. Variable key type support: Handles variables containing 'rsa-pss' (e.g., const keyType = 'rsa-pss')
 * 6. Promisified wrapper support: Handles util.promisify(crypto.generateKeyPair) patterns
 * 7. Value preservation: Maintains string literals, identifiers, template literals, and variable references
 * 8. Template literal handling: Extracts identifiers from template strings like `${variable}`
 * 9. This property support: Handles this.property patterns in classes and objects
 *
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();

	const cryptoBindings = getCryptoBindings(root);

	const allCalls = findCryptoCalls(rootNode, cryptoBindings);

	const edits = processRsaPssCalls(rootNode, allCalls);

	const spreadEdits = transformSpreadObjectDeclarations(rootNode, allCalls);
	const thisPropertyEdits = processThisPropertyReferences(rootNode, allCalls);

	const allEdits = [...edits, ...spreadEdits, ...thisPropertyEdits];

	if (!allEdits.length) return null;

	return rootNode.commitEdits(allEdits);
}

/**
 * Resolves a variable identifier to its string literal value if it's 'rsa-pss'
 */
function resolveVariableValue(rootNode: SgNode<JS>, identifier: string): boolean {
	return checkVariableDeclarations(rootNode, "const", identifier, RSA_PSS_REGEX) ||
		   checkVariableDeclarations(rootNode, "let", identifier, RSA_PSS_REGEX);
}

/**
 * Processes RSA-PSS generateKeyPair calls and transforms deprecated options
 */
function processRsaPssCalls(rootNode: SgNode<JS>, allCalls: SgNode<JS>[]): Edit[] {
	const edits: Edit[] = [];

	for (const call of allCalls) {
		const typeMatch = call.getMatch("TYPE");
		const optionsMatch = call.getMatch("OPTIONS");

		if (!typeMatch || !optionsMatch) continue;

		// Only process 'rsa-pss' key type
		const typeText = getText(typeMatch);
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
 * Analyzes imports and requires to determine all possible identifiers
 * that could refer to generateKeyPair or generateKeyPairSync functions
 */
function getCryptoBindings(root: SgRoot<JS>): string[] {
	// Handle both ES6 imports and CommonJS requires
	const bindings = resolveBindings(getModuleStatements(root, "crypto"), ["$.generateKeyPair", "$.generateKeyPairSync"]);

	// Find promisified assignments that use the discovered bindings
	const promisifiedBindings = getPromisifiedBindings(root, bindings);
	bindings.push(...promisifiedBindings);

	return bindings;
}

/**
 * Find promisified wrappers that use crypto bindings discovered by resolveBindingPath
 */
function getPromisifiedBindings(root: SgRoot<JS>, existingBindings: string[]): string[] {
	const rootNode = root.root();

	// Resolve promisify bindings from util imports
	const utilStatements = getModuleStatements(root, "util");
	const promisifyBindings = resolveBindings(utilStatements, "$.promisify");

	// If no promisify bindings found, check if there's a util import for fallback
	if (promisifyBindings.length === 0 && utilStatements.length > 0) {
		promisifyBindings.push("util.promisify");
	}

	// Find all promisified bindings using flatMap to eliminate nested loops
	const allPromisified = existingBindings.flatMap(binding => 
		promisifyBindings.flatMap(promisifyBinding => 
			findPromisifiedDeclarations(rootNode, binding, promisifyBinding)
		)
	);

	// Remove duplicates
	return Array.from(new Set(allPromisified));
}

/**
 * Find all function calls that match the crypto bindings
 */
function findCryptoCalls(rootNode: SgNode<JS>, bindings: string[]) {
	return bindings
		.flatMap(bindingName => rootNode.findAll({
			rule: {
				any: [
					{ pattern: `${bindingName}($TYPE, $OPTIONS, $CALLBACK)` },
					{ pattern: `${bindingName}($TYPE, $OPTIONS)` }
				]
			}
		}));
}

// Helper Functions
function getText(node: SgNode<JS> | undefined): string | null {
	const text = node?.text()?.trim();
	return text || null;
}

function getModuleStatements(root: SgRoot<JS>, moduleName: string): SgNode<JS>[] {
	const importStatements = safeGetImportStatements(root, moduleName);
	const requireCalls = safeGetRequireCalls(root, moduleName);
	return [...importStatements, ...requireCalls];
}

function getValueNodeFromPair(pair: SgNode<JS>): SgNode<JS> | undefined {
	return pair.find({
		rule: {
			any: [
				{ kind: "string" },
				{ kind: "identifier" },
				{ kind: "template_string" },
				{ kind: "member_expression" },
				{ kind: "call_expression" },
				{ kind: "binary_expression" },
				{ kind: "ternary_expression" },
				{ kind: "spread_element" }
			]
		}
	});
}

function resolveBindings(statements: SgNode<JS>[], paths: string | string[]): string[] {
	const pathArray = Array.isArray(paths) ? paths : [paths];
	
	return statements.flatMap(stmt => 
		pathArray
			.map(path => safeResolveBindingPath(stmt, path))
			.filter(Boolean)
	);
}

function getOptionsFromCalls(allCalls: SgNode<JS>[]): SgNode<JS>[] {
	return allCalls
		.map(call => call.getMatch("OPTIONS"))
		.filter(Boolean);
}

function isValidHashKey(key: string | undefined): key is "hash" | "mgf1Hash" {
	return key === "hash" || key === "mgf1Hash";
}

function findPromisifiedDeclarations(rootNode: SgNode<JS>, binding: string, promisifyBinding: string): string[] {
	const promisified = rootNode.findAll({
		rule: {
			kind: "lexical_declaration",
			has: {
				kind: "variable_declarator",
				has: {
					kind: "call_expression",
					pattern: `${promisifyBinding}(${binding})`
				}
			}
		}
	});

	return promisified
		.map(decl => {
			const variableDeclarator = decl.find({ rule: { kind: "variable_declarator" }});
			const identifier = variableDeclarator?.child(0);
			return identifier?.kind() === "identifier" ? getText(identifier) : null;
		})
		.filter(Boolean);
}

function checkVariableDeclarations(rootNode: SgNode<JS>, declarationType: "const" | "let", identifier: string, expectedValue: RegExp): boolean {
	const declarations = rootNode.findAll({
		rule: {
			pattern: `${declarationType} ${identifier} = $VALUE`
		}
	});

	return declarations.some(decl => {
		const valueText = getText(decl.getMatch("VALUE"));
		return valueText && expectedValue.test(valueText);
	});
}

function isRsaPssType(rootNode: SgNode<JS>, typeText: string): boolean {
	const isStringLiteral = RSA_PSS_REGEX.test(typeText);
	const isVariableWithRsaPss = IDENTIFIER_REGEX.test(typeText) &&
		resolveVariableValue(rootNode, typeText);
	return isStringLiteral || isVariableWithRsaPss;
}

function transformHashPropertiesInObject(objectNode: SgNode<JS>): Edit[] {
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
		
		const key = getText(keyNode);
		if (!isValidHashKey(key)) continue;
		
		const valueNode = getValueNodeFromPair(pair);
		const value = getText(valueNode);
		if (!value) continue;
		
		edits.push(pair.replace(`${HASH_MAPPINGS[key]}: ${value}`));
	}
	
	return edits;
}

function findAndTransformObjectDeclarations(rootNode: SgNode<JS>, patterns: string[]): Edit[] {
	return patterns.flatMap(pattern => {
		const declarations = rootNode.findAll({ rule: { pattern }});
		return declarations.flatMap(decl => transformHashPropertiesInObject(decl));
	});
}

function processOptionsReference(rootNode: SgNode<JS>, optionsMatch: SgNode<JS>): Edit[] {
	const optionsText = getText(optionsMatch);
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

function collectSpreadIdentifiers(allCalls: SgNode<JS>[]): string[] {
	const spreadNames = getOptionsFromCalls(allCalls)
		.flatMap((optionsMatch: SgNode<JS>) => 
			optionsMatch.findAll({ rule: { kind: "spread_element" }})
				.map((spread: SgNode<JS>) => getText(spread.find({ rule: { kind: "identifier" }})))
				.filter(Boolean)
		);
	
	return Array.from(new Set(spreadNames));
}

function transformSpreadObjectDeclarations(rootNode: SgNode<JS>, allCalls: SgNode<JS>[]): Edit[] {
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

function processThisPropertyReferences(rootNode: SgNode<JS>, allCalls: SgNode<JS>[]): Edit[] {
	const propertyNames = getOptionsFromCalls(allCalls)
		.map((optionsMatch: SgNode<JS>) => getText(optionsMatch))
		.filter((text: string | undefined) => text?.startsWith('this.'))
		.map((text: string) => text.replace('this.', ''))
		.filter(Boolean);
	
	const uniquePropertyNames = Array.from(new Set(propertyNames));
	
	return findAndTransformObjectDeclarations(rootNode, 
		uniquePropertyNames.map(propName => `this.${propName} = { $$$PROPS }`)
	);
}
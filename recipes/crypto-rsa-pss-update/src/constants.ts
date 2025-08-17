/**
 * Regular expressions for common patterns
 */
export const RSA_PSS_LITERAL_REGEX = /^['"]rsa-pss['"]$/;
export const IDENTIFIER_REGEX = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/**
 * Mapping from deprecated hash property names to new names
 */
export const HASH_MAPPINGS = {
	hash: "hashAlgorithm",
	mgf1Hash: "mgf1HashAlgorithm"
} as const;

/**
 * Crypto functions to resolve from imports
 */
export const CRYPTO_FUNCTIONS = ["$.generateKeyPair", "$.generateKeyPairSync"];

/**
 * AST node kinds that can represent values in object pairs
 */
export const VALUE_NODE_KINDS = [
	"string",
	"identifier",
	"template_string",
	"member_expression",
	"call_expression",
	"binary_expression",
	"ternary_expression",
	"spread_element"
] as const;
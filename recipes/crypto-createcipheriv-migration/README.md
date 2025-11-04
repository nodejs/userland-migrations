# crypto-createcipheriv-migration

> Migrates deprecated `crypto.createCipher()` / `crypto.createDecipher()` usage to the supported `crypto.createCipheriv()` / `crypto.createDecipheriv()` APIs with explicit key derivation and IV handling.

## Why?

Node.js removed `crypto.createCipher()` and `crypto.createDecipher()` in v22.0.0 (DEP0106). The legacy helpers derived keys with MD5 and no salt, and silently reused static IVs. This codemod replaces those calls with the modern, explicit APIs and scaffolds secure key derivation and IV management.

## What it does

- Detects CommonJS and ESM imports of `crypto` (including destructured bindings).
- Replaces invocations of `createCipher()` / `createDecipher()` with `createCipheriv()` / `createDecipheriv()`.
- Inserts scaffolding that derives keys with `crypto.scryptSync()` and generates random salts and IVs.
- Reminds developers to persist salt + IV for decryption and to adjust key/IV lengths per algorithm.
- Updates destructured imports to include the new helpers (`createCipheriv`, `createDecipheriv`, `randomBytes`, `scryptSync`).

## Example

```diff
-const cipher = crypto.createCipher(algorithm, password);
+const cipher = (() => {
+	const __dep0106Salt = crypto.randomBytes(16);
+	const __dep0106Key = crypto.scryptSync(password, __dep0106Salt, 32);
+	const __dep0106Iv = crypto.randomBytes(16);
+	// DEP0106: Persist __dep0106Salt and __dep0106Iv alongside the ciphertext so it can be decrypted later.
+	return crypto.createCipheriv(algorithm, __dep0106Key, __dep0106Iv);
+})();
```

## Caveats

- The codemod cannot guarantee algorithm-specific key/IV sizes. Review the generated `scryptSync` length and IV length defaults and adjust as needed.
- Decryption snippets include placeholders (`Buffer.alloc(16)`) that must be replaced with the salt and IV stored during encryption.
- If your project already wraps key derivation logic, you may prefer to adapt the generated scaffolding to call existing helpers.

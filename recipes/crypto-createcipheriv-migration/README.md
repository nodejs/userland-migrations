---
authors: AugustinMauroy
---

# DEP0106: crypto.createCipher() crypto.createCipheriv()

Replaces the removed `crypto.createCipher()` and `crypto.createDecipher()` with `crypto.createCipheriv()` and `crypto.createDecipheriv()`. Because the new APIs require an explicit key and IV, the codemod wraps each call site in an IIFE that derives a key via `scryptSync` and generates a random IV via `randomBytes`. For decryption calls, placeholder comments are inserted to remind you to supply the salt and IV that were stored during encryption.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/crypto-createcipheriv-migration
```

## Examples

### Example 1

Namespace CommonJS require — `createCipher`

```diff
 const crypto = require("node:crypto");

 const algorithm = "aes-256-cbc";
 const password = "s3cret";
-const cipher = crypto.createCipher(algorithm, password);
+const cipher = (() => {
+	const __dep0106Salt = crypto.randomBytes(16);
+	const __dep0106Key = crypto.scryptSync(password, __dep0106Salt, 32);
+	const __dep0106Iv = crypto.randomBytes(16);
+	// DEP0106: Persist __dep0106Salt and __dep0106Iv with the ciphertext so it can be decrypted later.
+	// DEP0106: Adjust the derived key length (32 bytes) and IV length to match the chosen algorithm.
+	return crypto.createCipheriv(algorithm, __dep0106Key, __dep0106Iv);
+})();
```

### Example 2

Destructured CommonJS require — `createCipher`; `randomBytes` and `scryptSync` are added to the destructured binding.

```diff
-const { createCipher } = require("node:crypto");
+const { createCipheriv: createCipher, randomBytes, scryptSync } = require("node:crypto");

-const cipher = createCipher("aes-128-cbc", "password123");
+const cipher = (() => {
+	const __dep0106Salt = randomBytes(16);
+	const __dep0106Key = scryptSync("password123", __dep0106Salt, 32);
+	const __dep0106Iv = randomBytes(16);
+	// DEP0106: Persist __dep0106Salt and __dep0106Iv with the ciphertext so it can be decrypted later.
+	// DEP0106: Adjust the derived key length (32 bytes) and IV length to match the chosen algorithm.
+	return createCipher("aes-128-cbc", __dep0106Key, __dep0106Iv);
+})();
```

### Example 3

Namespace CommonJS require — `createDecipher`; placeholder TODOs are inserted for the salt and IV that must be retrieved from storage.

```diff
 const crypto = require("crypto");

-const decipher = crypto.createDecipher("aes-256-cbc", "pw");
+const decipher = (() => {
+	// DEP0106: Replace the placeholders below with the salt and IV that were stored with the ciphertext.
+	const __dep0106Salt = /* TODO: stored salt Buffer */ Buffer.alloc(16);
+	const __dep0106Iv = /* TODO: stored IV Buffer */ Buffer.alloc(16);
+	const __dep0106Key = crypto.scryptSync("pw", __dep0106Salt, 32);
+	// DEP0106: Ensure __dep0106Salt and __dep0106Iv match the values used during encryption.
+	return crypto.createDecipheriv("aes-256-cbc", __dep0106Key, __dep0106Iv);
+})();
```

## Notes

The generated IIFE scaffolding uses `scryptSync` for key derivation and `randomBytes` for IV/salt generation. The salt produced during encryption **must** be stored alongside the ciphertext and supplied again at decryption time — the `// DEP0106: Persist ...` comment highlights this. The default derived-key length is 32 bytes and the IV length is 16 bytes; review these values and adjust them to match the requirements of your chosen algorithm.

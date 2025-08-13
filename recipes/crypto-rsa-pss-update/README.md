# crypto-rsa-pss-update

Codemod to handle Node.js crypto deprecation DEP0154 by transforming deprecated RSA-PSS key generation options.

## What it does

This codemod transforms deprecated RSA-PSS crypto options in `crypto.generateKeyPair()` and `crypto.generateKeyPairSync()` calls:

- `hash` → `hashAlgorithm`
- `mgf1Hash` → `mgf1HashAlgorithm`

The transformation only applies to calls with `'rsa-pss'` as the key type.

## Examples

**Before**

```js
const crypto = require("node:crypto");

crypto.generateKeyPair(
	"rsa-pss",
	{
		modulusLength: 2048,
		hash: "sha256",
		mgf1Hash: "sha1",
		saltLength: 32,
	},
	(err, publicKey, privateKey) => {
		// callback
	},
);

crypto.generateKeyPairSync("node:rsa-pss", {
	modulusLength: 2048,
	hash: "sha256",
});
```

**After**

```js
const crypto = require("crypto");

crypto.generateKeyPair(
	"rsa-pss",
	{
		modulusLength: 2048,
		hashAlgorithm: "sha256",
		mgf1HashAlgorithm: "sha1",
		saltLength: 32,
	},
	(err, publicKey, privateKey) => {
		// callback
	},
);

crypto.generateKeyPairSync("rsa-pss", {
	modulusLength: 2048,
	hashAlgorithm: "sha256",
});
```

## Usage

```bash
npx codemod@next @nodejs/crypto-rsa-pss-update
```

## Supports

- Both `crypto.generateKeyPair()` and `crypto.generateKeyPairSync()`
- Destructured imports: `const { generateKeyPair } = require('crypto')`
- Only transforms `'rsa-pss'` key type calls
- Preserves all other options and call structure

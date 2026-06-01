---
authors: nievasdev
---

# DEP0154: RSA-PSS hash / mgf1Hash hashAlgorithm / mgf1HashAlgorithm

Renames the deprecated `hash` and `mgf1Hash` options in RSA-PSS key generation calls to `hashAlgorithm` and `mgf1HashAlgorithm` respectively. Applies to both `crypto.generateKeyPair()` and `crypto.generateKeyPairSync()`, as well as promisified wrappers created with `util.promisify()`.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/crypto-rsa-pss-update
```

## Examples

### Example 1

Transforms `hash` and `mgf1Hash` in inline options objects.

```diff
 const crypto = require('crypto');

 crypto.generateKeyPair('rsa-pss', {
   modulusLength: 2048,
-  hash: 'sha256',
+  hashAlgorithm: 'sha256',
   saltLength: 32
 }, (err, publicKey, privateKey) => {
   console.log('Generated keys');
 });

 crypto.generateKeyPairSync('rsa-pss', {
   modulusLength: 2048,
-  hash: 'sha256',
-  mgf1Hash: 'sha1'
+  hashAlgorithm: 'sha256',
+  mgf1HashAlgorithm: 'sha1'
 });
```

### Example 2

Works with ESM namespace imports.

```diff
 import * as crypto from 'node:crypto';

 crypto.generateKeyPair('rsa-pss', {
   modulusLength: 2048,
-  hash: 'sha256',
+  hashAlgorithm: 'sha256',
   saltLength: 32
 }, (err, publicKey, privateKey) => {
   console.log('Generated keys');
 });

 crypto.generateKeyPairSync('rsa-pss', {
   modulusLength: 2048,
-  mgf1Hash: 'sha256'
+  mgf1HashAlgorithm: 'sha256'
 });
```

## Notes

### Limitations

Only transforms calls where the key type argument is the literal string `'rsa-pss'`. Calls using other key types such as `'rsa'` or `'ed25519'` are left untouched, even if they happen to contain a `hash` property.

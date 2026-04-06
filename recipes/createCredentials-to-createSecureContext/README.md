---
authors: 0hmx
---

# DEP0010: crypto.createCredentials() tls.createSecureContext()

Replaces the deprecated `crypto.createCredentials()` with `tls.createSecureContext()` from `node:tls`. Updates the import or require statement accordingly, handling namespace imports, named imports, and dynamic imports.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/createCredentials-to-createSecureContext
```

## Examples

### Example 1

Named ESM import

```diff
-import { createCredentials } from 'node:crypto';
+import { createSecureContext } from 'node:tls';

-const credentials = createCredentials({
+const credentials = createSecureContext({
   key: privateKey,
   cert: certificate,
   ca: [caCertificate]
 });
```

### Example 2

Named CommonJS require

```diff
-const { createCredentials } = require('node:crypto');
+const { createSecureContext } = require('node:tls');

-const credentials = createCredentials({
+const credentials = createSecureContext({
   key: privateKey,
   cert: certificate,
   ca: [caCertificate]
 });
```

### Example 3

Namespace ESM import

```diff
-import * as crypto from 'node:crypto';
+import * as tls from 'node:tls';

-const credentials = crypto.createCredentials({
+const credentials = tls.createSecureContext({
   key: fs.readFileSync('server-key.pem'),
   cert: fs.readFileSync('server-cert.pem')
 });
```

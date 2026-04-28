---
authors: technologic-technologic
---

# DEP0064: tls.createSecurePair() new tls.TLSSocket()

Replaces deprecated `tls.createSecurePair(...)` calls with `new tls.TLSSocket(underlyingSocket, options)`. The four positional arguments (`secureContext`, `isServer`, `requestCert`, `rejectUnauthorized`) are converted into named properties of an options object. The result variable is renamed from `pair` to `socket`, and the import/require declaration is updated from `createSecurePair` to `TLSSocket`.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/tls-create-secure-pair-to-tls-socket
```

## Examples

### Example 1

Namespace `require` — the call is replaced with `new tls.TLSSocket(...)` and the result variable renamed:

```diff
const tls = require('node:tls');
-const pair = tls.createSecurePair(credentials);
+const socket = new tls.TLSSocket(underlyingSocket, { secureContext: credentials });
```

### Example 2

Destructured `require` with all four positional arguments — each argument becomes a named option:

```diff
-const { createSecurePair } = require('node:tls');
+const { TLSSocket } = require('node:tls');
-const pair = createSecurePair(credentials, true, true, false);
+const socket = new TLSSocket(underlyingSocket, { secureContext: credentials, isServer: true, requestCert: true, rejectUnauthorized: false });
```

### Example 3

ESM named import:

```diff
-import { createSecurePair } from 'node:tls';
+import { TLSSocket } from 'node:tls';
-const pair = createSecurePair(credentials);
+const socket = new TLSSocket(underlyingSocket, { secureContext: credentials });
```

## Notes

The first argument to `createSecurePair` (the secure context) maps to `secureContext` in the `TLSSocket` options object. The underlying stream that `TLSSocket` requires as its first positional argument is inserted as `underlyingSocket` — review each call site to supply the correct stream reference for your application.

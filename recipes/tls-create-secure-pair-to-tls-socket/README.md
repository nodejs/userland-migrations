# `tls.createSecurePair` deprecation DEP0064

This recipe transforms the usage from the deprecated `createSecurePair()` to `TLSSocket()`.

See [DEP0064](https://nodejs.org/api/deprecations.html#dep0064-tlscreatesecurepair).

## Examples

### 1) Basic `createSecurePair` usage
```diff
-const { createSecurePair } = require('node:tls');
+const { TLSSocket } = require('node:tls');

-const pair = createSecurePair(credentials);
+const socket = new TLSSocket(underlyingSocket, { secureContext: credentials });
```

---

### 2) Namespace import (CJS)
```diff
-const tls = require('node:tls');
+const tls = require('node:tls');

-const pair = tls.createSecurePair(credentials);
+const socket = new tls.TLSSocket(underlyingSocket, { secureContext: credentials });
```

---

### 3) With server context
```diff
-const { createSecurePair } = require('node:tls');
+const { TLSSocket } = require('node:tls');

-const pair = createSecurePair(credentials, true, true, false);
+const socket = new TLSSocket(underlyingSocket, {
+  secureContext: credentials,
+  isServer: true,
+  requestCert: true,
+  rejectUnauthorized: false
+});
```

---

### 4) ESM named import
```diff
-import { createSecurePair } from 'node:tls';
+import { TLSSocket } from 'node:tls';

-const pair = createSecurePair(credentials);
+const socket = new TLSSocket(underlyingSocket, { secureContext: credentials });
```

---

### 5) ESM namespace import
```diff
-import * as tls from 'node:tls';
+import * as tls from 'node:tls';

-const pair = tls.createSecurePair(credentials);
+const socket = new tls.TLSSocket(underlyingSocket, { secureContext: credentials });
```

---

### 6) Mixed usage with other TLS functions
```diff
-const { createSecurePair, createServer } = require('node:tls');
+const { TLSSocket, createServer } = require('node:tls');

-const pair = createSecurePair(credentials);
-const server = createServer(options);
+const socket = new TLSSocket(underlyingSocket, { secureContext: credentials });
+const server = createServer(options);
```

---

### 7) ESM default import
```diff
import tls from 'node:tls';

-const pair = tls.createSecurePair(credentials);
+const socket = new tls.TLSSocket(underlyingSocket, { secureContext: credentials });
```

---

### 8) ESM dynamic import (assignment)
```diff
const tls = await import('node:tls');

-const pair = tls.createSecurePair(credentials);
+const socket = new tls.TLSSocket(underlyingSocket, { secureContext: credentials });
```

---

### 9) ESM dynamic import (thenable)
```diff
import('node:tls').then(tls => {
-  const pair = tls.createSecurePair(credentials);
+  const socket = new tls.TLSSocket(underlyingSocket, { secureContext: credentials });
});
```

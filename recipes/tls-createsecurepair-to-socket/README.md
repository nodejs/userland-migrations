# `tls.createSecurePair` deprecation DEP0064

This recipe transforms the usage from the deprecated `createSecurePair()` to `TLSSocket()`.

See [DEP0064](https://nodejs.org/api/deprecations.html#dep0064-tlscreatesecurepair).

## Examples

### Case 1: Basic `createSecurePair` usage

**Before:**
```js
const { createSecurePair } = require('node:tls');

const pair = createSecurePair(credentials);
```

**After:**
```js
const { TLSSocket } = require('node:tls');

const socket = new TLSSocket(underlyingSocket, { secureContext: credentials });
```

---

### Case 2: Namespace import

**Before:**
```js
const tls = require('node:tls');

const pair = tls.createSecurePair(credentials);
```

**After:**
```js
const tls = require('node:tls');

const socket = new tls.TLSSocket(underlyingSocket, { secureContext: credentials });
```

---

### Case 3: With server context

**Before:**
```js
const { createSecurePair } = require('node:tls');

const pair = createSecurePair(credentials, true, true, false);
```

**After:**
```js
const { TLSSocket } = require('node:tls');

const socket = new TLSSocket(underlyingSocket, {
  secureContext: credentials,
  isServer: true,
  requestCert: true,
  rejectUnauthorized: false
});
```

---

### Case 4: ESM import

**Before:**
```js
import { createSecurePair } from 'node:tls';

const pair = createSecurePair(credentials);
```

**After:**
```js
import { TLSSocket } from 'node:tls';

const socket = new TLSSocket(underlyingSocket, { secureContext: credentials });
```

---

### Case 5: ESM namespace import

**Before:**
```js
import * as tls from 'node:tls';

const pair = tls.createSecurePair(credentials);
```

**After:**
```js
import * as tls from 'node:tls';

const socket = new tls.TLSSocket(underlyingSocket, { secureContext: credentials });
```

---

### Case 6: Mixed usage with other TLS functions

**Before:**
```js
const { createSecurePair, createServer } = require('node:tls');

const pair = createSecurePair(credentials);
const server = createServer(options);
```

**After:**
```js
const { TLSSocket, createServer } = require('node:tls');

const socket = new TLSSocket(underlyingSocket, { secureContext: credentials });
const server = createServer(options);
```

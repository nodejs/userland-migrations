# `http.request` DEP0195

This recipe provides a guide for migrating from the deprecated `http.request` and its synchronous and promise-based counterparts to the new `http.request` method in Node.js.

See [DEP0195](https://nodejs.org/api/deprecations.html#DEP0195).

## Examples

**Before:**

```js
const http = require("node:http");
const message = http.OutgoingMessage();
const response = http.ServerResponse(socket);
```

```js
import { IncomingMessage, ClientRequest } from "node:http";
const incoming = IncomingMessage(socket);
const request = ClientRequest(options);
```

**After:**

```js
const http = require("node:http");
const message = new http.OutgoingMessage();
const response = new http.ServerResponse(socket);
```

```js
import { IncomingMessage, ClientRequest } from "node:http";
const incoming = new IncomingMessage(socket);
const request = new ClientRequest(options);
```

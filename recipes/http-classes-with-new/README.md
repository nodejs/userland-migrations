---
authors: max-programming
---
# DEP0195: Instantiating node:http Classes Without new

Adds the `new` keyword to calls that instantiate `http.Agent`, `http.ClientRequest`, `http.IncomingMessage`, `http.OutgoingMessage`, `http.Server`, and `http.ServerResponse` without it. Works with both `require` and `import` syntax, including named and namespace imports.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/http-classes-with-new
```

## Examples

### Example 1

`require` — all six classes gain the `new` keyword.

```diff
 const http = require("node:http");

-const agent = http.Agent();
-const request = http.ClientRequest(options);
-const incoming = http.IncomingMessage(socket);
-const message = http.OutgoingMessage();
-const server = http.Server();
-const response = http.ServerResponse(socket);
+const agent = new http.Agent();
+const request = new http.ClientRequest(options);
+const incoming = new http.IncomingMessage(socket);
+const message = new http.OutgoingMessage();
+const server = new http.Server();
+const response = new http.ServerResponse(socket);
```

### Example 2

Named `import` — destructured class names are handled the same way.

```diff
 import {
   Agent,
   ClientRequest,
   IncomingMessage,
   OutgoingMessage,
   Server,
   ServerResponse,
 } from "node:http";

-const agent = Agent();
-const request = ClientRequest(options);
-const incoming = IncomingMessage(socket);
-const message = OutgoingMessage();
-const server = Server();
-const response = ServerResponse(socket);
+const agent = new Agent();
+const request = new ClientRequest(options);
+const incoming = new IncomingMessage(socket);
+const message = new OutgoingMessage();
+const server = new Server();
+const response = new ServerResponse(socket);
```

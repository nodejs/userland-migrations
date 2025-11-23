# `repl` classes DEP0185

This recipe provides a guide for migrating from the deprecated instantiation of `node:repl` classes without `new` to proper class instantiation in Node.js.

See [DEP0185](https://nodejs.org/api/deprecations.html#DEP0185).

## Example

**Before:**

```js
const repl = require("node:repl");
const { REPLServer, Recoverable } = require("node:repl");
import { REPLServer } from "node:repl";
const { REPLServer: REPL } = await import("node:repl");

// Missing 'new' keyword
const server1 = repl.REPLServer();
const server2 = REPLServer({ prompt: ">>> " });
const server3 = repl.Recoverable();
const error = Recoverable(new SyntaxError());
const server4 = REPL({ prompt: ">>> " });
```

**After:**

```js
const repl = require("node:repl");
const { REPLServer, Recoverable } = require("node:repl");
import { REPLServer } from "node:repl";
const { REPLServer: REPL } = await import("node:repl");

// With 'new' keyword
const server1 = new repl.REPLServer();
const server2 = new REPLServer({ prompt: ">>> " });
const server3 = new repl.Recoverable();
const error = new Recoverable(new SyntaxError());
const server4 = new REPL({ prompt: ">>> " });
```

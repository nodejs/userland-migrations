# `repl.REPLServer` DEP0185

This recipe provides a guide for migrating from the deprecated instantiation of `node:repl` classes without `new` to proper class instantiation in Node.js.

See [DEP0185](https://nodejs.org/api/deprecations.html#DEP0185).

## Examples

**Before:**

```js
const repl = require("node:repl");
const server = repl.REPLServer();
```

**After:**

```js
const repl = require("node:repl");
const server = new repl.REPLServer();
```

---

**Before:**

```js
const { REPLServer } = require("node:repl");
const server = REPLServer({ prompt: ">>> " });
```

**After:**

```js
const { REPLServer } = require("node:repl");
const server = new REPLServer({ prompt: ">>> " });
```

---

**Before:**

```js
import { REPLServer } from "node:repl";
const server = REPLServer();
```

**After:**

```js
import { REPLServer } from "node:repl";
const server = new REPLServer();
```

---
authors: AugustinMauroy
---
# DEP0185: Instantiating node:repl Classes Without new

Adds the missing `new` keyword to calls to `repl.REPLServer()` and `repl.Recoverable()` that are invoked as plain functions. Works with CommonJS `require`, ESM named imports, ESM namespace imports, and dynamic imports.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/repl-classes-with-new
```

## Examples

### Example 1

CommonJS namespace import — every class call without `new` is fixed:

```diff
const repl = require("node:repl");

-const server = repl.REPLServer();
+const server = new repl.REPLServer();

-const server2 = repl.REPLServer({
+const server2 = new repl.REPLServer({
  prompt: "custom> ",
  input: process.stdin,
  output: process.stdout
});

-const error = repl.Recoverable(new SyntaxError());
+const error = new repl.Recoverable(new SyntaxError());

function createREPL(options) {
-  return repl.REPLServer(options);
+  return new repl.REPLServer(options);
}
```

### Example 2

ESM named import — destructured class identifiers are handled the same way:

```diff
import { REPLServer } from "node:repl";

-const server = REPLServer();
+const server = new REPLServer();

-const server2 = REPLServer({
+const server2 = new REPLServer({
  prompt: ">>> ",
  useColors: true
});

function createCustomREPL() {
-  return REPLServer({
+  return new REPLServer({
    prompt: "custom> "
  });
}
```

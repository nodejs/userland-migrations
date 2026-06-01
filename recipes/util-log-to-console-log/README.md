---
authors: brunocroh
---

# DEP0059: util.log() console.log()

Replaces the deprecated `util.log(message)` with `console.log(new Date().toLocaleString(), message)`, preserving the timestamp prefix that `util.log` appended automatically. The `util` import is removed when it becomes unused after the transformation.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/util-log-to-console-log
```

## Examples

### Example 1

Namespace `require` — the import is removed:

```diff
-const util = require("node:util");
-
-util.log("Hello world");
+console.log(new Date().toLocaleString(), "Hello world");
```

### Example 2

Destructured named import — the import is removed:

```diff
-const { log } = require("node:util");
-
-log("Application started");
-log("Processing request");
+console.log(new Date().toLocaleString(), "Application started");
+console.log(new Date().toLocaleString(), "Processing request");
```

### Example 3

Named ESM import — the import is removed:

```diff
-import { log } from "node:util";
-
-log("Server listening on port 3000");
+console.log(new Date().toLocaleString(), "Server listening on port 3000");
```

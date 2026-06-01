---
authors: brunocroh
---

# DEP0026/DEP0027/DEP0028/DEP0029: util Print Functions console

Replaces four deprecated `util` output functions with their `console` equivalents:

- `util.print(...)` (DEP0026) `console.log(...)`
- `util.puts(...)` (DEP0027) `console.log(...)`
- `util.debug(...)` (DEP0028) `console.error(...)`
- `util.error(...)` (DEP0029) `console.error(...)`

The `util` import is removed when it becomes unused after the transformation.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/util-print-to-console-log
```

## Examples

### Example 1

`util.print` `console.log`:

```diff
-const util = require("node:util");
-
-util.print("Hello world");
+console.log("Hello world");
```

### Example 2

`util.puts` `console.log`:

```diff
-const util = require("node:util");
-
-util.puts("Hello world");
+console.log("Hello world");
```

### Example 3

`util.debug` `console.error`:

```diff
-const util = require("node:util");
-
-util.debug("Hello world");
+console.error("Hello world");
```

### Example 4

`util.error` `console.error`:

```diff
-const util = require("node:util");
-
-util.error("Hello world");
+console.error("Hello world");
```

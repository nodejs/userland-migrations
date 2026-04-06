---
authors: brunocroh
---

# DEP0197: util.types.isNativeError() Error.isError()

Replaces all usages of the deprecated `util.types.isNativeError()` with `Error.isError()`. The codemod handles `util.types.isNativeError(x)`, `types.isNativeError(x)`, and destructured `isNativeError(x)` call patterns. The `util` import is removed when it becomes unused after the transformation.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/types-is-native-error
```

## Examples

### Example 1

Named ESM import — the entire import statement is removed:

```diff
-import { types } from "node:util";
-
-if (types.isNativeError(err)) {
+if (Error.isError(err)) {
   // handle the error
 }
```

### Example 2

Multiple require patterns in the same file — all three call forms are rewritten and all three imports are removed:

```diff
-const util = require("node:util");
-const { types } = require("util");
-const {
-  types: { isNativeError },
-} = require("util");
 const err = new Error();

-if (util.types.isNativeError(err)) {
+if (Error.isError(err)) {
   // handle the error
 }

-if (types.isNativeError(err)) {
+if (Error.isError(err)) {
   // handle the error
 }

-if (isNativeError(err)) {
+if (Error.isError(err)) {
   // handle the error
 }
```

### Example 3

When `types` is still used for other methods, only `isNativeError` calls are replaced and the import is kept:

```diff
 const { types } = require("util");

-if (types.isNativeError(err)) {
+if (Error.isError(err)) {
   // handle the error
 }

 if (types.isMap([])) {
 }
```

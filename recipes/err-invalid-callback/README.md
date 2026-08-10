---
authors: syhstanley
---

# DEP0159: `ERR_INVALID_CALLBACK` to `ERR_INVALID_ARG_TYPE`

Node.js APIs used to throw errors with the `ERR_INVALID_CALLBACK` code when they received an invalid callback. That code was removed in favor of `ERR_INVALID_ARG_TYPE`, which those APIs now throw instead. This codemod rewrites string references to the removed code in error-code contexts — equality comparisons, object properties such as `assert.throws()` expectations, `switch` cases, and string-matching calls like `.includes()` — while leaving unrelated strings, such as log messages, untouched. It also collapses checks that already tested for both codes into a single condition. See [DEP0159](https://nodejs.org/api/deprecations.html#DEP0159).

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/err-invalid-callback
```

## Examples

### Error-code comparisons

Equality checks against the old code are rewritten; both single- and double-quoted strings are supported.

```diff
 try {
   fs.readFile("file.txt", "invalid-callback");
 } catch (err) {
-  if (err.code === "ERR_INVALID_CALLBACK") {
+  if (err.code === "ERR_INVALID_ARG_TYPE") {
     console.error("Invalid callback provided");
   }
 }
```

### Expected-error objects

Object properties, such as `assert.throws()` expectations, are updated.

```diff
 assert.throws(
   () => fs.readFile("file.txt", 123),
-  { code: "ERR_INVALID_CALLBACK" }
+  { code: "ERR_INVALID_ARG_TYPE" }
 );
```

### `switch` cases

`case` labels matching the old code are rewritten; other cases are left alone.

```diff
 switch (error.code) {
-  case "ERR_INVALID_CALLBACK":
+  case "ERR_INVALID_ARG_TYPE":
     console.log("Invalid callback");
     break;
 }
```

### String-matching calls

Arguments to string-matching methods such as `.includes()` are updated.

```diff
-if (err.toString().includes("ERR_INVALID_CALLBACK")) {
+if (err.toString().includes("ERR_INVALID_ARG_TYPE")) {
   // Handle callback error
 }
```

### Deduplication of dual checks

Code that already checked for both codes is collapsed into a single condition after the replacement.

```diff
 const isCallbackError =
-  err.code === "ERR_INVALID_CALLBACK" ||
   err.code === "ERR_INVALID_ARG_TYPE";
```

## Notes

- Replacement is context-aware: only string literals in recognized error-code positions are rewritten. Strings in unrelated contexts, such as `console.warn("ERR_INVALID_CALLBACK")` or thrown message text, are intentionally left unchanged.
- The recognized string-matching methods are `includes`, `indexOf`, `match`, `test`, `startsWith`, and `endsWith`.

<!-- sync_to_learn: false -->

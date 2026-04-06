---
authors: brunocroh
---

# DEP0138: process.mainModule require.main

Replaces deprecated `process.mainModule` with `require.main` in CommonJS modules.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/process-main-module
```

## Examples

### Example 1

Direct property access:

```diff
-if (process.mainModule === module) {
+if (require.main === module) {
   // cli thing
 } else {
   // module thing
 }
```

### Example 2

`mainModule` destructured from `process` — the destructuring is removed and all usages are replaced with `require.main`:

```diff
-const { mainModule } = process;
-
-if (mainModule === module) {
-  console.log(mainModule.filename);
+if (require.main === module) {
+  console.log(require.main.filename);
 }
```

### Example 3

`mainModule` destructured from a `require("node:process")` call alongside other bindings — only `mainModule` is removed from the destructure; the remaining bindings are preserved:

```diff
-const { mainModule, env, cwd } = require("node:process");
+const { env, cwd } = require("node:process");

-if (mainModule === module) {
+if (require.main === module) {
   console.log(env, cwd);
 }
```

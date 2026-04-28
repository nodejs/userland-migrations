---
authors: matheusmorett2
---

# DEP0100: process.assert() node:assert

Replaces deprecated `process.assert()` and `process.assert.*()` calls with equivalent calls from the `node:assert` module, adding the appropriate `import` or `require` declaration automatically.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/process-assert-to-node-assert
```

## Examples

### Example 1

Global `process.assert` in a script (ESM `import` added):

```diff
+import assert from "node:assert";
-process.assert(condition, "Basic assertion");
-process.assert.strictEqual(a, b, "Values should be equal");
+assert(condition, "Basic assertion");
+assert.strictEqual(a, b, "Values should be equal");
```

### Example 2

CommonJS file (`require` added):

```diff
+const assert = require("node:assert");
-process.assert(condition, "Basic assertion");
-process.assert.strictEqual(a, b, "Values should be equal");
+assert(condition, "Basic assertion");
+assert.strictEqual(a, b, "Values should be equal");
```

### Example 3

ESM file that explicitly imports `process`:

```diff
 import process from "node:process";
+import assert from "node:assert";
-process.assert(value, "Process assertion");
-process.assert.strictEqual(obj1, obj2);
+assert(value, "Process assertion");
+assert.strictEqual(obj1, obj2);
```

### Example 4

Multiple `assert` methods in a single file:

```diff
+import assert from "node:assert";
-process.assert(condition);
-process.assert.ok(value);
-process.assert.strictEqual(a, b);
-process.assert.notStrictEqual(a, c);
-process.assert.throws(() => { throw new Error(); });
+assert(condition);
+assert.ok(value);
+assert.strictEqual(a, b);
+assert.notStrictEqual(a, c);
+assert.throws(() => { throw new Error(); });
```

## Notes

The codemod reads `package.json` to determine whether the project uses ES modules or CommonJS, and inserts `import assert from "node:assert"` or `const assert = require("node:assert")` accordingly. If an `assert` import or require already exists, the existing binding is reused and no duplicate declaration is added.

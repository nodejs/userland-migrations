# Tape to Node.js Test Runner Codemod

This codemod migrates tests written using `tape` to the native Node.js test runner (`node:test`).

## Features

- Replaces `tape` imports with `node:test` and `node:assert/strict`.
- Converts `test(name, (t) => ...)` to `test(name, async (t) => ...)`.
- Maps `tape` assertions to `node:assert` equivalents.
- Handles `t.plan` (by commenting it out).
- Handles `t.end` (removes it for async tests, converts to `done` callback for callback-style tests).
- Handles `t.test` subtests (adds `await`).
- Converts `t.teardown` to `t.after`.

## Example

### Basic Equality

```diff
- import test from "tape";
+ import { test } from 'node:test';
+ import assert from 'node:assert/strict';

- test("basic equality", (t) => {
+ test("basic equality", async (t) => {
-   t.plan(4);
+   // t.plan(4);
-   t.equal(1, 1, "equal numbers");
+   assert.strictEqual(1, 1, "equal numbers");
-   t.notEqual(1, 2, "not equal numbers");
+   assert.notStrictEqual(1, 2, "not equal numbers");
-   t.strictEqual(true, true, "strict equality");
+   assert.strictEqual(true, true, "strict equality");
-   t.notStrictEqual("1", 1, "not strict equality");
+   assert.notStrictEqual("1", 1, "not strict equality");
-   t.end();
+   // t.end();
  });
```

### Async Tests

```diff
- import test from "tape";
+ import { test } from 'node:test';
+ import assert from 'node:assert/strict';

  function someAsyncThing() {
    return new Promise((resolve) => setTimeout(() => resolve(true), 50));
  }

- test("async test with promises", async (t) => {
+ test("async test with promises", async (t) => {
-   t.plan(1);
+   // t.plan(1);
    const result = await someAsyncThing();
-   t.ok(result, "async result is truthy");
+   assert.ok(result, "async result is truthy");
  });
```

### Callback Style

```diff
- import test from "tape";
+ import { test } from 'node:test';
+ import assert from 'node:assert/strict';

- test("callback style", (t) => {
+ test("callback style", (t, done) => {
    setTimeout(() => {
-     t.ok(true);
+     assert.ok(true);
-     t.end();
+     done();
    }, 100);
  });
```

### Dynamic Import

```diff
  async function run() {
-   const test = await import("tape");
+   const { test } = await import('node:test');
+   const { default: assert } = await import('node:assert/strict');
  
-   test("dynamic import", (t) => {
+   test("dynamic import", async (t) => {
-     t.ok(true);
+     assert.ok(true);
-     t.end();
+     // t.end();
    });
  }
```


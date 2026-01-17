# Tape to Node.js Test Runner Codemod

This codemod migrates tests written using [`tape`](https://github.com/tape-testing/tape) v5 to the native Node.js test runner ([`node:test`](https://nodejs.org/api/test.html)).

## Features

- Replaces `tape` imports with `node:test` and `node:assert`.
- Converts `test(name, (t) => ...)` to `test(name, async (t) => ...)`.
- Maps `tape` assertions to `node:assert` equivalents, including many aliases (e.g., `t.is`, `t.equals`, `t.deepEquals`).
- Preserves `t.plan()` calls as-is (node:test supports plan-based assertions).
- Intelligently handles `t.end()`:
  - Converts to `done()` callback when used with `t.plan()` or inside nested callbacks (e.g., `setTimeout`)
  - Comments out when not needed in async tests
  - Automatically adds `done` parameter to test callback when needed
- Handles `t.test` subtests (adds `await` and converts to `test()`).
- Converts `t.teardown` to `t.after`.
- Converts `t.comment` to `t.diagnostic`.
- Migrates `t.timeoutAfter(ms)` to `{ timeout: ms }` test option.
- Supports `test.skip` and `test.only`.
- Handles `test.onFinish` and `test.onFailure` (comments them out with TODO and warning).
- Supports loose equality assertions (e.g., `t.looseEqual` -> `assert.equal`).

## Example

### Basic Equality

```diff
- import test from "tape";
+ import { test } from 'node:test';
+ import assert from 'node:assert';

- test("basic equality", (t) => {
+ test("basic equality", async (t) => {
-   t.equal(1, 1, "equal numbers");
+   assert.strictEqual(1, 1, "equal numbers");
-   t.notEqual(1, 2, "not equal numbers");
+   assert.notStrictEqual(1, 2, "not equal numbers");
-   t.strictEqual(true, true, "strict equality");
+   assert.strictEqual(true, true, "strict equality");
-   t.notStrictEqual("1", 1, "not strict equality");
+   assert.notStrictEqual("1", 1, "not strict equality");
  });
```

### Plan with End (Done Style)

```diff
- import test from "tape";
+ import { test } from 'node:test';
+ import assert from 'node:assert';

- test("plan with end", (t) => {
+ test("plan with end", async (t, done) => {
    t.plan(2);
-   t.equal(1, 1, "first assertion");
+   assert.strictEqual(1, 1, "first assertion");
-   t.equal(2, 2, "second assertion");
+   assert.strictEqual(2, 2, "second assertion");
-   t.end();
+   done();
  });
```

### Async Tests

```diff
- import test from "tape";
+ import { test } from 'node:test';
+ import assert from 'node:assert';

  function someAsyncThing() {
    return new Promise((resolve) => setTimeout(() => resolve(true), 50));
  }

- test("async test with promises", async (t) => {
+ test("async test with promises", async (t) => {
    t.plan(1);
    const result = await someAsyncThing();
-   t.ok(result, "async result is truthy");
+   assert.ok(result, "async result is truthy");
  });
```

### Callback Style

```diff
- import test from "tape";
+ import { test } from 'node:test';
+ import assert from 'node:assert';

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

### Timeout Handling

```diff
- import test from "tape";
+ import { test } from 'node:test';
+ import assert from 'node:assert';

- test("timeout test", (t) => {
-   t.timeoutAfter(100);
+ test("timeout test", { timeout: 100 }, async (t) => {
-   t.ok(true);
+   assert.ok(true);
-   t.end();
+   // t.end();
  });
```

### Dynamic Import

```diff
  async function run() {
-   const test = await import("tape");
+   const { test } = await import('node:test');
+   const { default: assert } = await import('node:assert');

-   test("dynamic import", (t) => {
+   test("dynamic import", async (t) => {
-     t.ok(true);
+     assert.ok(true);
-     t.end();
+     // t.end();
    });
  }
```

## Known Limitations

- `test.onFinish()` and `test.onFailure()` have no direct equivalent in `node:test` and will be commented out with a TODO.
- When `t.timeoutAfter()` is used with a variable options object (not inline), the codemod will add a TODO comment instead of automatically migrating it.
- `t.plan()` is preserved as-is since `node:test` TestContext supports it, but be aware of behavioral differences between Tape and Node.js test runner regarding plan validation.
- CLI migration, we don't touch to your `package.json` or test scripts. You will need to update them manually to use `node --test` command instead of `tape`.

> [!WARNING]
> This codemod only migrate main `tape` package usage. If you use some "plugins" or additional packages (like `tape-promise`), you will need to handle them manually.

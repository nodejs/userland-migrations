# Mocha to Node.js Test Runner

This codemod converts Mocha v8 tests to Node.js test runner (v22, v24).

## Features

- Automatically adds `node:test` imports/requires
- Converts global `describe`, `it`, and hooks to imported versions
- Transforms `done` callbacks to `(t, done)` signature
- Converts `this.skip()` to `t.skip()`
- Converts `this.timeout()` to `{ timeout: N }` options
- Preserves function styles (doesn't convert between `function()` and arrow functions)
- Supports both CommonJS and ESM

## Important Points

- Does **not** touch imports except `mocha` imports and `node:test` imports
- Does **not** convert callback style from `function()` to arrow functions `() => {}` or vice versa
- Supports both CJS and ESM

## Examples

### Example 1: Basic Test Case

```diff
  const assert = require('assert');
+ const { describe, it } = require('node:test');
  describe('Array', function() {
    describe('#indexOf()', function() {
      it('should return -1 when the value is not present', function() {
        const arr = [1, 2, 3];
        assert.strictEqual(arr.indexOf(4), -1);
      });
    });
  });
```

### Example 2: Async Test Case

```diff
  const assert = require('assert');
+ const { describe, it } = require('node:test');
  describe('Async Test', function() {
-     it('should complete after a delay', async function(done) {
+     it('should complete after a delay', async function() {
          const result = await new Promise(resolve => setTimeout(() => resolve(42), 100));
          assert.strictEqual(result, 42);
      });
  });
```

### Example 3: Hooks

```diff
  const assert = require('assert');
  const fs = require('fs');
+ const { describe, before, after, it } = require('node:test');
  describe('File System', function() {
      before(function() {
          fs.writeFileSync('test.txt', 'Hello, World!');
      });

      after(function() {
          fs.unlinkSync('test.txt');
      });

      it('should read the file', function() {
          const content = fs.readFileSync('test.txt', 'utf8');
          assert.strictEqual(content, 'Hello, World!');
      });
  });
```

### Example 4: `done` Callback

```diff
  const assert = require('assert');
+ const { describe, it } = require('node:test');
  describe('Callback Test', function() {
-     it('should call done when complete', function(done) {
+     it('should call done when complete', function(t, done) {
          setTimeout(() => {
              assert.strictEqual(1 + 1, 2);
              done();
          }, 100);
      });
  });
```

### Example 5: Skipped Tests

```diff
  const assert = require('assert');
+ const { describe, it } = require('node:test');
  describe('Skipped Test', function() {
      it.skip('should not run this test', function() {
          assert.strictEqual(1 + 1, 3);
      });
-     it('should also be skipped', function() {
-         this.skip();
+     it('should also be skipped', function(t) {
          assert.strictEqual(1 + 1, 3);
+         t.skip();
      });
  });
```

### Example 6: Dynamic/generated tests

```diff
  const assert = require('assert');
+ const { describe, it } = require('node:test');
  describe('Dynamic Tests', function() {
      const tests = [1, 2, 3];
      tests.forEach((test) => {
          it(`should handle test ${test}`, function() {
              assert.strictEqual(test % 2, 0);
          });
      });
  });
```

### Example 7: Timeouts handling

This timeout handling works for `describe`, `it` and hooks.

```diff
  const assert = require('assert');
+ const { describe, it } = require('node:test');
- describe('Timeout Test', function() {
-     this.timeout(500);
-
-     it('should complete within 100ms', function(done) {
-         this.timeout(100);
+ describe('Timeout Test', { timeout: 500 }, function() {
+     it('should complete within 100ms', { timeout: 100 }, function(t, done) {
          setTimeout(done, 500); // This will fail
-
      });

-     it('should complete within 200ms', function() {
-         this.timeout(200);
+     it('should complete within 200ms', { timeout: 200 }, function() {
          setTimeout(done, 100); // This will pass
      });
  });
```

## Caveats

- `node:test` doesn't support the `retry` option that Mocha has, so any tests using that will need to be handled separately.

## References

- [Node Test Runner](https://nodejs.org/api/test.html)
- [Mocha](https://mochajs.org/)

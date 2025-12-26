# Mocha to Node.js Test Runner

This recipe migrate Mocha v8 tests to Node.js test runner (v22, v24+)

## Features

- Automatically adds `node:test` imports/requires
- Converts global `describe`, `it`, and hooks to imported versions
- Transforms `done` callbacks to `(t, done)` signature
- Converts `this.skip()` to `t.skip()`
- Converts `this.timeout(N)` to `{ timeout: N }` options
- Preserves function styles (doesn't convert between `function()` and arrow functions)
- Supports both CommonJS and ESM

## Examples

### Example 1: Basic

```diff
```
 const assert = require('assert');
+const { describe, it } = require('node:test');

 describe('Array', function() {
        describe.skip('#indexOf()', function() {
                it('should return -1 when the value is not present', function() {
                        const arr = [1, 2, 3];
                        assert.strictEqual(arr.indexOf(4), -1);
                });
        });
 });
```

### Example 2: Async

```diff
```
 const assert = require('assert');
+const { describe, it } = require('node:test');
 describe('Async Test', function() {
-       it('should complete after a delay', async function(done) {
+       it('should complete after a delay', async function(t, done) {
                const result = await new Promise(resolve => setTimeout(() => resolve(42), 100));
                assert.strictEqual(result, 42);
        });
 });
```

### Example 3: Hooks

```diff
```
 const assert = require('assert');
 const fs = require('fs');
+const { describe, before, after, it } = require('node:test');
 describe('File System', () => {
        before(function() {
                fs.writeFileSync('test.txt', 'Hello, World!');
        });

        after(() => {
                fs.unlinkSync('test.txt');
        });

        it('should read the file', () => {
                const content = fs.readFileSync('test.txt', 'utf8');
                assert.strictEqual(content, 'Hello, World!');
        });
 });
 ```

### Example 4: Done

```diff
```
const assert = require('assert');
+const { describe, it } = require('node:test');
describe('Callback Test', function() {
-       it('should call done when complete', function(done) {
+       it('should call done when complete', function(t, done) {
                setTimeout(() => {
                        assert.strictEqual(1 + 1, 2);
                        done();
                }, 100);
        });
})
```

### Example 5: Skipped

```diff
```
 const assert = require('assert');
+const { describe, it } = require('node:test');
 describe('Skipped Test', () => {
        it.skip('should not run this test', () => {
                assert.strictEqual(1 + 1, 3);
        });
-       it('should also be skipped', () => {
-               this.skip();
+       it('should also be skipped', (t) => {
+               t.skip();
                assert.strictEqual(1 + 1, 3);
        });

-       it('should also be skipped 2', (done) => {
-               this.skip();
+       it('should also be skipped 2', (t, done) => {
+               t.skip();
                assert.strictEqual(1 + 1, 3);
        });

-       it('should also be skipped 3', x => {
-               this.skip();
+       it('should also be skipped 3', (t, x) => {
+               t.skip();
                assert.strictEqual(1 + 1, 3);
        });
 })
```

### Example 6: Dynamic

```diff
```
 const assert = require('assert');
+const { describe, it } = require('node:test');
 describe('Dynamic Tests', () => {
        const tests = [1, 2, 3];

        tests.forEach((test) => {
                it(`should handle test ${test}`, () => {
                        assert.strictEqual(test % 2, 0);
                });
        });
 });
```

### Example 7: Timeouts

```diff
const assert = require('assert');
-describe('Timeout Test', function() {
-       this.timeout(500);
+const { describe, it } = require('node:test');
+describe('Timeout Test', { timeout: 500 }, function() {
+
+
+       it('should complete within 100ms', { timeout: 100 }, (t, done) => {

-       it('should complete within 100ms', (done) => {
-               this.timeout(100);
                setTimeout(done, 500); // This will fail
        });

-       it('should complete within 200ms', function(done) {
-               this.timeout(200);
+       it('should complete within 200ms', { timeout: 200 }, function(t, done) {
+
              setTimeout(done, 100); // This will pass
      });
});
```

## Caveats

* `node:test` doesn't support the `retry` option that Mocha has, so any tests using that will need to be handled separately.
```

## References
- [Node Test Runner](https://nodejs.org/api/test.html)
- [Mocha](https://mochajs.org/)

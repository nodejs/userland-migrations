---
authors: Xstoudi
---

# Mocha to Node.js Test Runner

Migrates [Mocha](https://mochajs.org/) 8.x test suites to the built-in [Node.js test runner](https://nodejs.org/api/test.html) (`node:test`, available in Node.js 22.x and 24.x). It adds the required `node:test` imports for the globals a file uses (`describe`, `it`, `before`, `after`, `beforeEach`, `afterEach`), converts `done` callbacks to the `(t, done)` signature, rewrites `this.skip()` to `t.skip()` and `this.timeout(N)` to `{ timeout: N }` options, and preserves the original function style (it never converts between `function()` and arrow functions). Both CommonJS and ESM files are supported, and the `mocha` and `@types/mocha` dependencies are removed from `package.json` afterwards.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/mocha-to-node-test-runner
```

## Examples

### Adding `node:test` imports (CommonJS)

Global `describe`/`it` usage keeps working once the matching `require('node:test')` is inserted; modifiers like `describe.skip` are already compatible.

```diff
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

### Adding `node:test` imports (ESM)

In ESM files an `import` statement is inserted instead.

```diff
 import assert from 'assert';
+import { describe, it } from 'node:test';

 describe('Array', function() {
   describe.skip('#indexOf()', function() {
     it('should return -1 when the value is not present', function() {
```

### Hooks

Only the hooks actually used in the file are added to the import list.

```diff
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
```

### `done` callbacks

Mocha passes `done` as the first callback argument; `node:test` passes the test context first, so `(done)` becomes `(t, done)`.

```diff
 const assert = require('assert');
+const { describe, it } = require('node:test');

 describe('Callback Test', function() {
-  it('should call done when complete', function(done) {
+  it('should call done when complete', function(t, done) {
     setTimeout(() => {
       assert.strictEqual(1 + 1, 2);
       done();
     }, 100);
   });
 });
```

### Skipping with `this.skip()`

`this.skip()` becomes `t.skip()`, with the test context parameter `t` added to the callback signature as needed.

```diff
 const assert = require('assert');
+const { describe, it } = require('node:test');

 describe('Skipped Test', () => {
   it.skip('should not run this test', () => {
     assert.strictEqual(1 + 1, 3);
   });
-  it('should also be skipped', () => {
-    this.skip();
+  it('should also be skipped', (t) => {
+    t.skip();
     assert.strictEqual(1 + 1, 3);
   });

-  it('should also be skipped 2', (done) => {
-    this.skip();
+  it('should also be skipped 2', (t, done) => {
+    t.skip();
     assert.strictEqual(1 + 1, 3);
   });
 });
```

### Timeouts

`this.timeout(N)` calls on suites and tests move into the `{ timeout: N }` options argument.

```diff
 const assert = require('assert');
+const { describe, it } = require('node:test');

-describe('Timeout Test', function() {
-  this.timeout(500);
+describe('Timeout Test', { timeout: 500 }, function() {

-  it('should complete within 100ms', (done) => {
-    this.timeout(100);
+  it('should complete within 100ms', { timeout: 100 }, (t, done) => {
     setTimeout(done, 500); // This will fail
   });

-  it('should complete within 200ms', function(done) {
-    this.timeout(200);
+  it('should complete within 200ms', { timeout: 200 }, function(t, done) {
     setTimeout(done, 100); // This will pass
   });
 });
```

## Notes

- After the transformation, the codemod detects your package manager and removes the `mocha` and `@types/mocha` dependencies from `package.json`.

### Limitations

- `node:test` does not support Mocha's `retry` option, so tests relying on it need to be handled separately.

<!-- sync_to_learn: true -->

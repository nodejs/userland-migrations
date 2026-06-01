---
authors: lluisemper
---

# DEP0030: SlowBuffer Buffer.allocUnsafeSlow()

Replaces deprecated `SlowBuffer` constructor and function calls with `Buffer.allocUnsafeSlow()` and updates the corresponding `require`/`import` statement so that `Buffer` is imported instead of `SlowBuffer`.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/slow-buffer-to-buffer-alloc-unsafe-slow
```

## Examples

### Example 1

`require` with member access — both the binding and the property are renamed, and usages are replaced:

```diff
-const SlowBuffer = require('buffer').SlowBuffer;
+const Buffer = require('buffer').Buffer;

-const buf1 = new SlowBuffer(1024);
+const buf1 = Buffer.allocUnsafeSlow(1024);
-const buf2 = SlowBuffer(512);
+const buf2 = Buffer.allocUnsafeSlow(512);
```

### Example 2

Destructured `require` — `SlowBuffer` is replaced by `Buffer` in the destructuring:

```diff
-const { SlowBuffer } = require('buffer');
+const { Buffer } = require('buffer');
-const buf3 = new SlowBuffer(256);
+const buf3 = Buffer.allocUnsafeSlow(256);
```

### Example 3

ESM named import — the import specifier is updated and the call site is rewritten:

```diff
-import { SlowBuffer } from 'buffer';
+import { Buffer } from 'buffer';
-const buf = new SlowBuffer(1024);
+const buf = Buffer.allocUnsafeSlow(1024);
```

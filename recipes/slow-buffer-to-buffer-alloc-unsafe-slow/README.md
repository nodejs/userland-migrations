# SlowBuffer to Buffer.allocUnsafeSlow Codemod

This codemod migrates deprecated `SlowBuffer` usage to `Buffer.allocUnsafeSlow()` to handle Node.js [DEP0030](https://nodejs.org/api/deprecations.html#DEP0030).

## What it does

This codemod transforms:

1. `SlowBuffer` constructor calls to `Buffer.allocUnsafeSlow()`
2. Direct `SlowBuffer` calls to `Buffer.allocUnsafeSlow()`
3. Import/require statements be synced with new function

## Example

```diff
- import { SlowBuffer } from "buffer";
+ import { Buffer } from "buffer";
- const buf = new SlowBuffer(1024);
+ const buf = Buffer.allocUnsafeSlow(1024);
`````

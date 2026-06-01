---
authors: Eliekhoury17
---

# DEP0108: zlib.bytesRead zlib.bytesWritten

Replaces the deprecated `.bytesRead` property with `.bytesWritten` on zlib stream objects. The codemod tracks variables assigned from any of the zlib factory functions (`createGzip`, `createGunzip`, `createDeflate`, `createInflate`, `createBrotliCompress`, `createBrotliDecompress`, `createUnzip`) and also handles function parameters used as stream arguments. Both CommonJS `require` and ESM `import` are supported.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/zlib-bytesread-to-byteswritten
```

## Examples

### Example 1

Variable assigned from a zlib factory via a namespace require:

```diff
 const zlib = require("node:zlib");
 const gzip = zlib.createGzip();
 gzip.on("end", () => {
-    console.log("Bytes processed:", gzip.bytesRead);
+    console.log("Bytes processed:", gzip.bytesWritten);
 });
```

### Example 2

Named ESM import:

```diff
 import { createGzip } from "node:zlib";
 const gzip = createGzip();
-const bytesProcessed = gzip.bytesRead;
+const bytesProcessed = gzip.bytesWritten;
```

### Example 3

Function parameter used as a stream — the codemod replaces `.bytesRead` on any parameter inside a function that receives a zlib stream:

```diff
 const zlib = require("node:zlib");
 function trackProgress(stream) {
     setInterval(() => {
-        console.log(`Progress: ${stream.bytesRead} bytes`);
+        console.log(`Progress: ${stream.bytesWritten} bytes`);
     }, 1000);
 }
```

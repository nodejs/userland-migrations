---
authors: nekojanai
---

# buffer.atob() / buffer.btoa() Buffer

Migrates legacy `buffer.atob()` and `buffer.btoa()` calls to their modern `Buffer` equivalents. The `buffer` module import is removed when no other `buffer` APIs remain in use.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/buffer-atob-btoa
```

## Examples

### Example 1

`buffer.atob()` `Buffer.from(x, 'base64').toString('binary')`

```diff
-const buffer = require('node:buffer');
 const data = 'SGVsbG8gV29ybGQh'; // "Hello World!" in base64
-const decodedData = buffer.atob(data);
+const decodedData = Buffer.from(data, 'base64').toString('binary');
 console.log(decodedData); // Outputs: Hello World!
```

### Example 2

`buffer.btoa()` `Buffer.from(x, 'binary').toString('base64')`

```diff
-const buffer = require('node:buffer');
 const data = 'Hello World!';
-const encodedData = buffer.btoa(data);
+const encodedData = Buffer.from(data, 'binary').toString('base64');
 console.log(encodedData); // Outputs: SGVsbG8gV29ybGQh
```

### Example 3

Named import — only `atob` is removed from the import; other named exports from `buffer` are preserved.

```diff
-import { atob, isUtf8 } from "node:buffer";
+import { isUtf8 } from "node:buffer";
 const data = 'Hello World!';
 isUtf8(data);
-atob(data);
+Buffer.from(data, 'base64').toString('binary');
```

### Example 4

When other `buffer` APIs are still referenced, the import statement is kept.

```diff
 import buffer from "node:buffer";
 buffer.constants.MAX_LENGTH;
 const data = 'Hello World!';
-buffer.btoa(data);
+Buffer.from(data, 'binary').toString('base64');
```

## Notes

### Limitations

The `buffer` import is only removed when no other `buffer` APIs are referenced in the file. If any other property of the `buffer` namespace is still accessed, the import statement is preserved.

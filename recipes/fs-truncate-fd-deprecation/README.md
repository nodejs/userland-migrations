---
authors: AugustinMauroy
---

# DEP0081: fs.truncate() fs.ftruncate()

Replaces `fs.truncate()` and `fs.truncateSync()` with `fs.ftruncate()` and `fs.ftruncateSync()` when the first argument is a file descriptor. Import and `require` destructuring statements are updated accordingly. Calls that pass a file path string as the first argument are left untouched.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/fs-truncate-fd-deprecation
```

## Examples

### Example 1

Destructured `require` with a file descriptor provided via an `open` callback.

```diff
-const { truncate, open, close } = require('node:fs');
+const { ftruncate, open, close } = require('node:fs');

 open('file.txt', 'w', (err, fd) => {
   if (err) throw err;
-  truncate(fd, 10, (err) => {
+  ftruncate(fd, 10, (err) => {
     if (err) throw err;
     close(fd, () => { });
   });
 });
```

### Example 2

Namespace `require` with a file descriptor from `fs.openSync`.

```diff
 const fs = require('node:fs');

 const fd = fs.openSync('file.txt', 'w');
 try {
-  fs.truncateSync(fd, 10);
+  fs.ftruncateSync(fd, 10);
 } finally {
   fs.closeSync(fd);
 }
```

## Notes

### Limitations

The codemod uses a conservative heuristic to determine whether the first argument is a file descriptor. It only transforms calls where the first argument is a numeric literal, a variable assigned from `fs.openSync` / `openSync`, or an `fd` parameter inside a callback passed to `fs.open` / `open`. Calls where the first argument is a file path string or any other expression that cannot be statically identified as a file descriptor are not transformed.

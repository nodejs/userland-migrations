---
authors: brunocroh
---

# DEP0178: dirent.path dirent.parentPath

Replaces `dirent.path` with `dirent.parentPath` for `fs.Dirent` objects obtained from `fs.readdir()`, `fs.readdirSync()`, and `fs.opendir()` calls (including their `fs/promises` equivalents). Handles `for...of` loops, array methods like `forEach`, and destructured parameters.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/dirent-path-to-parent-path
```

## Examples

### Example 1

`dirent.path` inside a `for...of` loop over `readdir` results.

```diff
 const { readdir } = require('node:fs/promises');

 const entries = await readdir('/some/path', { withFileTypes: true });
 for (const dirent of entries) {
-  console.log(dirent.path);
+  console.log(dirent.parentPath);
 }
```

### Example 2

`dirent.path` inside a `forEach` callback with an arrow function.

```diff
 import { readdir } from 'node:fs/promises';

 const entries = await readdir('./directory', { withFileTypes: true });
 entries.forEach((dirent) => {
-  const fullPath = `${dirent.path}/${dirent.name}`;
+  const fullPath = `${dirent.parentPath}/${dirent.name}`;
   console.log(fullPath);
 });
```

### Example 3

Destructured `path` parameter in a callback passed to `fs.readdir`.

```diff
 const fs = require('node:fs');

 fs.readdir('/path', { withFileTypes: true }, (err, dirents) => {
   if (err) throw err;

-  dirents.forEach(({ name, path, isDirectory }) => {
-    console.log(`${name} in ${path}`);
+  dirents.forEach(({ name, parentPath, isDirectory }) => {
+    console.log(`${name} in ${parentPath}`);
   });
 });
```

### Example 4

`dirent.path` inside a `for await...of` loop over `opendir` results.

```diff
 import { opendir } from 'node:fs/promises';

 const dir = await opendir('./');
 for await (const dirent of dir) {
-  console.log(`Found ${dirent.name} in ${dirent.path}`);
+  console.log(`Found ${dirent.name} in ${dirent.parentPath}`);
 }
```

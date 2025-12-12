# `dirent.path` DEP0178

This codemod transforms the usage of `dirent.path` to use `dirent.parentPath`.

See [DEP0178](https://nodejs.org/api/deprecations.html#DEP0178).

## Example

### readdir

```diff
  const { readdir } = require('node:fs/promises');
  const entries = await readdir('/some/path', { withFileTypes: true });
  for (const dirent of entries) {
-   console.log(dirent.path);
+   console.log(dirent.parentPath);
  }
```


### opendir

```diff
  import { opendir } from 'node:fs/promises';
  const dir = await opendir('./');
  for await (const dirent of dir) {
-   console.log(`Found ${dirent.name} in ${dirent.path}`);
+   console.log(`Found ${dirent.name} in ${dirent.parentPath}`);
  }
```

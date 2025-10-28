# `dirent.path` DEP0178

This codemod transforms the usage of `dirent.path` to use `dirent.parentPath`.

See [DEP0178](https://nodejs.org/api/deprecations.html#DEP0178).

## Example

**Before:**

```js
const { readdir } = require('node:fs/promises');

const entries = await readdir('/some/path', { withFileTypes: true });
for (const dirent of entries) {
  console.log(dirent.path);
}
```

**After:**

```js
const { readdir } = require('node:fs/promises');

const entries = await readdir('/some/path', { withFileTypes: true });
for (const dirent of entries) {
  console.log(dirent.parentPath);
}
```

**Before:**

```js
import { opendir } from 'node:fs/promises';

const dir = await opendir('./');
for await (const dirent of dir) {
  console.log(`Found ${dirent.name} in ${dirent.path}`);
}
```

After:

```js
import { opendir } from 'node:fs/promises';

const dir = await opendir('./');
for await (const dirent of dir) {
  console.log(`Found ${dirent.name} in ${dirent.parentPath}`);
}
```

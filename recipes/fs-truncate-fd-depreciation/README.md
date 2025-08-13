# DEP0081: `fs.truncate()` using a file descriptor

This recipe transforms the usage of `fs.truncate()` to `fs.ftruncateSync()` when a file descriptor is used.

See [DEP0081](https://nodejs.org/api/deprecations.html#DEP0081).

## Example

**Before:**
```js
const { truncate, open, close } = require('node:fs');

open('file.txt', 'w', (err, fd) => {
  if (err) throw err;
  truncate(fd, 10, (err) => {
    if (err) throw err;
    close(fd, () => {});
  });
});
```

**After:**
```js
const { ftruncate, open, close } = require('node:fs');

open('file.txt', 'w', (err, fd) => {
  if (err) throw err;
  ftruncate(fd, 10, (err) => {
    if (err) throw err;
    close(fd, () => {});
  });
});
```

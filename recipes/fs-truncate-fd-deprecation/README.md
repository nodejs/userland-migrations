# DEP0081: `fs.truncate()` using a file descriptor

This recipe transforms the usage of `fs.truncate()` to `fs.ftruncateSync()` when a file descriptor is used.

See [DEP0081](https://nodejs.org/api/deprecations.html#DEP0081).

## Example

```diff
- const { truncate, open, close } = require('node:fs');
+ const { ftruncate, open, close } = require('node:fs');

  open('file.txt', 'w', (err, fd) => {
    if (err) throw err;
-   truncate(fd, 10, (err) => {
+   ftruncate(fd, 10, (err) => {
      if (err) throw err;
      close(fd, () => {});
    });
  });
`````

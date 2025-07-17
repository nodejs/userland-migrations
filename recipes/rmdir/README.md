# `fs.rmdir` DEP0147

This recipe provides a guide for migrating from the deprecated `fs.rmdir` and its synchronous and promise-based counterparts to the new `fs.rm` method in Node.js.

It's related to the deprecation notice [DEP0147](https://nodejs.org/api/deprecations.html#DEP0147).

## Examples

**Before:**

```js
// Using fs.rmdir with the recursive option
fs.rmdir(path, { recursive: true }, callback);

// Using fs.rmdirSync with the recursive option
fs.rmdirSync(path, { recursive: true });

// Using fs.promises.rmdir with the recursive option
fs.promises.rmdir(path, { recursive: true });
```

**After:**

```js
// Using fs.rm with recursive and force options
fs.rm(path, { recursive: true, force: true }, callback);

// Using fs.rmSync with recursive and force options
fs.rmSync(path, { recursive: true, force: true });

// Using fs.promises.rm with recursive and force options
fs.promises.rm(path, { recursive: true, force: true });
```

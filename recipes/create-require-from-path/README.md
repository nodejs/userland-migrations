# `createRequireFromPath` DEP0130

This recipe transforms the usage of `createRequireFromPath` to use the `createRequire` function from the `node:module` module.

See [DEP0130](https://nodejs.org/api/deprecations.html#DEP0130).

## Example

**Before:**
```js
const { createRequireFromPath } = require('node:module');

// Using createRequireFromPath
const requireFromPath = createRequireFromPath('/path/to/module');
const myModule = requireFromPath('./myModule.cjs');
```

**After:**
```js
 const { createRequire } = require('node:module');

// Using createRequire with a specific path
const require = createRequire('/path/to/module');
const myModule = require('./myModule.cjs');
```

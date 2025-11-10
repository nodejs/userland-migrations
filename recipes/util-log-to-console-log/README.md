# `util.log` DEP0059

This recipe transforms the usage of `util.log()` to use `console.log()`.

See [DEP0059](https://nodejs.org/api/deprecations.html#DEP0059).

## Example

**Before:**

```js
const util = require("node:util");

util.log("Hello world");
```

**After:**

```js
console.log(new Date().toLocaleString(), "Hello world");
```

**Before:**

```js
const { log } = require("node:util");

log("Application started");
log("Processing request");
```

After:

```js
console.log(new Date().toLocaleString(), "Application started");
console.log(new Date().toLocaleString(), "Processing request");
```

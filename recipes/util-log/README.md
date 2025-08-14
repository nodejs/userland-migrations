# `util.log` DEP0059

This recipe transforms the usage of `log.util($$$ARG)` to use `console.log(new Date().toLocaleString(), $$$ARG)`.

See [DEP0059](https://nodejs.org/api/deprecations.html#DEP0059).

## Example

**Before:**

```js
const util = require("node:util");

util.log("Hello world");
```

After:

```js
console.log(new Date().toLocaleString(), 'Hello world');
Case 2: Destructured import with only log
```

Before:

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

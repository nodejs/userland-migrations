# `util.print, util.puts, util.debug, util.error` DEP0026,DEP0027,DEP0028,DEP0029

This recipe transforms the usage of log functions from util, `print`, `puts`, `debug`, `error` to use `console.log()` or `console.error()`.

## Example

**Before:**

```js
const util = require("node:util");

util.print("Hello world");
util.puts("Hello world");
util.debug("Hello world");
util.error("Hello world");
```

**After:**

```js
console.log("Hello world");
console.log("Hello world");
console.error("Hello world");
console.error("Hello world");
```

**Before:**

```js
const { print, error } = require("node:util");

print("Application started");
error("Processing request");
```

After:

```js
console.log("Application started");
console.error("Processing request");
```

# `util.print, util.puts, util.debug, util.error` DEP0026,DEP0027,DEP0028,DEP0029

This recipe transforms the usage of log functions from util, `print`, `puts`, `debug`, `error` to use `console.log()` or `console.error()`.

See [DEP0026](https://nodejs.org/api/deprecations.html#DEP0026).
See [DEP0027](https://nodejs.org/api/deprecations.html#DEP0027).
See [DEP0028](https://nodejs.org/api/deprecations.html#DEP0028).
See [DEP0029](https://nodejs.org/api/deprecations.html#DEP0029).

## Example

```diff
- const util = require("node:util");
-
- util.print("Hello world");
- util.puts("Hello world");
- util.debug("Hello world");
- util.error("Hello world");
-
+ console.log("Hello world");
+ console.log("Hello world");
+ console.error("Hello world");
+ console.error("Hello world");
+
`````

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

# `util._extend` DEP0060

This recipe transforms the usage of deprecated `util._extend()` to use `Object.assign()`.

See [DEP0060](https://nodejs.org/api/deprecations.html#DEP0060).

## Example

```diff
- const util = require("node:util");
- const target = { a: 1 };
- const source = { b: 2 };
- const result = util._extend(target, source);
+ const target = { a: 1 };
+ const source = { b: 2 };
+ const result = Object.assign(target, source);
```

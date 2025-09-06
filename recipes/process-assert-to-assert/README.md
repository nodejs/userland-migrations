# `process.assert` DEP0100

This recipe transforms the usage of `process.assert` to use `assert` module.

See [DEP0100](https://github.com/nodejs/userland-migrations/issues/197).

## Example

**Before:**

```js
process.assert(condition, "Assertion failed");
```

**After:**

```js
import assert from "node:assert";
assert(condition, "Assertion failed");
```

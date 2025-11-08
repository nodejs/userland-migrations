# `process.assert` to `node:assert` DEP0100

This recipe transforms the usage of `process.assert` to use `node:assert` module.

See [DEP0100](https://nodejs.org/api/deprecations.html#DEP0100).

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

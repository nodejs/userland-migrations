# `types.isNativeError` DEP0197

This recipe transforms the usage of `types.isNativeError` to use the `Error.isError`.

See [DEP0197](https://nodejs.org/api/deprecations.html#DEP0197).

## Example

**Before:**

```js
import { types } from "node:util";

if (types.isNativeError(err)) {
	// handle the error
}
```

**After:**

```js
if (Error.isError(err)) {
	// handle the error
}
```

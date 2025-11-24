# `types.isWebAssemblyCompiledModule` DEP0177

This recipe transforms the usage of `types.isWebAssemblyCompiledModule` to use the `instanceof WebAssembly.Module` operator.

See [DEP0177](https://nodejs.org/api/deprecations.html#DEP0177).

## Example

**Before:**

```js
import { types } from "node:util";

if (types.isWebAssemblyCompiledModule(value)) {
	// handle the module
}
```

**After:**

```js
if (value instanceof WebAssembly.Module) {
	// handle the module
}
```

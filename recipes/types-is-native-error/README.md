# `types.isNativeError` DEP0197

This recipe transforms the usage of `types.isNativeError` to use the `Error.isError`.

See [DEP0197](https://nodejs.org/api/deprecations.html#DEP0197).

## Example

```diff
- import { types } from "node:util";

- if (types.isNativeError(err)) {
+ if (Error.isError(err)) {
  	// handle the error
  }
`````

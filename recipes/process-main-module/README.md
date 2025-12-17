# `process.mainModule` DEP0138

This recipe transforms the usage of `process.mainModule` to use `require.main` in CommonJS modules.

See [DEP0138](https://nodejs.org/api/deprecations.html#DEP0138).

## Example

```diff
- if (process.mainModule === "mod.js") {
+ if (require.main === "mod.js") {
  	// cli thing
  } else {
  	// module thing
  }
`````

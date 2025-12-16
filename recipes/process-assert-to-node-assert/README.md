# `process.assert` to `node:assert` DEP0100

This recipe transforms the usage of `process.assert` to use `node:assert` module.

See [DEP0100](https://nodejs.org/api/deprecations.html#DEP0100).

## Example

```diff
+ import assert from "node:assert";
- process.assert(condition, "Assertion failed");
+ assert(condition, "Assertion failed");
`````

## Additional Notes

This codemod use [`fs` capability](https://docs.codemod.com/jssg/security) to read the `package.json` file and determine if the project is using ES modules or CommonJS. Based on this information, it adds the appropriate import statement for the `assert` module.

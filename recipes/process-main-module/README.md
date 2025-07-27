# `createRequireFromPath` DEP0130

This recipe transforms the usage of `process.mainModule` to use the `require.main`.

See [DEP0138](https://nodejs.org/api/deprecations.html#DEP0138).

## Example

**Before:**

```js
if (process.mainModule === "mod.js") {
	// cli thing
} else {
	// module thing
}
```

**After:**

```js
if (require.main === "mod.js") {
	// cli thing
} else {
	// module thing
}
```

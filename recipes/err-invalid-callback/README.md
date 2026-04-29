# DEP0159: `ERR_INVALID_CALLBACK` replaced by `ERR_INVALID_ARG_TYPE`

This recipe replaces references to the deprecated `ERR_INVALID_CALLBACK` error code with `ERR_INVALID_ARG_TYPE`.

See [DEP0159](https://nodejs.org/api/deprecations.html#DEP0159).

## Example

```diff
  try {
    fs.readFile("file.txt", "invalid-callback");
  } catch (err) {
-   if (err.code === "ERR_INVALID_CALLBACK") {
+   if (err.code === "ERR_INVALID_ARG_TYPE") {
      console.error("Invalid callback provided");
    }
  }
```

Also handles deduplication when both codes were already checked:

```diff
  const isCallbackError =
-   err.code === "ERR_INVALID_CALLBACK" ||
-   err.code === "ERR_INVALID_ARG_TYPE";
+   err.code === "ERR_INVALID_ARG_TYPE";
```

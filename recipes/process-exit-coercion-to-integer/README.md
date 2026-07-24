# `process.exit(code)` / `process.exitCode` DEP0164

This recipe migrates non-integer values passed to `process.exit(code)` and assigned to `process.exitCode`.

See [DEP0164](https://nodejs.org/api/deprecations.html#DEP0164).

## What it changes

- Preserves valid values:
  - integer numbers
  - integer strings
  - `undefined`
  - `null`
- Converts boolean values to explicit numeric exit codes.
- Wraps floating-point numeric expressions with `Math.floor(...)`.
- Converts non-integer string literals to `1`.
- For `process.exitCode = { code: ... }`, extracts `code` when possible and coerces when needed.

## Example

```diff
- process.exit(0.5 + 0.7)
+ process.exit(Math.floor(0.5 + 0.7))
```

```diff
- const success = false;
- process.exitCode = success;
+ const success = false;
+ process.exitCode = success ? 0 : 1;
```

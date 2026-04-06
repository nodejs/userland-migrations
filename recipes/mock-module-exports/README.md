# Mock Module Exports

This migration trasforming use of deprecated `options.defaultExport` and `options.namedExports` on
`node:test.mock`

## Example

```diff
mock.module('…', {
-   defaultExport: …,
-   namedExports: {
-   	foo: …
-   },
+   exports: {
+   	default: …,
+   	foo: …,
+   },
});
```

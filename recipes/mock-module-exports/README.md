---
authors: brunocroh
---

# mock.module() defaultExport / namedExports exports

Updates `mock.module()` calls to use the new `exports` object API, merging the deprecated `defaultExport` and `namedExports` options into a single `exports` object where the default export is keyed as `default`.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/mock-module-exports
```

## Examples

### Example 1

Both `defaultExport` and `namedExports` present with inline object:

```diff
 mock.module('example', {
-  defaultExport: 'bar',
-  namedExports: {
-    foo: 'foo',
-    baz: 'baz',
-  },
+  exports: {
+    default: 'bar',
+    foo: 'foo',
+    baz: 'baz',
+  },
 });
```

### Example 2

`namedExports` given as a variable reference — the spread is wrapped with a `|| {}` fallback:

```diff
 mock.module('example2', {
-  defaultExport: 'bar',
-  namedExports: namedExports,
+  exports: {
+    default: 'bar',
+    ...(namedExports || {}),
+  },
 });
```

### Example 3

Only `defaultExport`, no named exports:

```diff
 mock.module('example', {
-  defaultExport: 'bar',
+  exports: {
+    default: 'bar',
+  },
 });
```

### Example 4

Only `namedExports`, no default export:

```diff
 mock.module('example', {
-  namedExports: {
-    foo: 'foo',
-  },
+  exports: {
+    foo: 'foo',
+  },
 });
```

## Notes

When `namedExports` is a variable (identifier) rather than an inline object, the codemod emits a spread with a `|| {}` fallback (`...(obj || {})`) to preserve safe behaviour when the variable may be `undefined` or `null`.

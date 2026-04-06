---
authors: AugustinMauroy
---
# DEP0044-DEP0058: util.is*() Methods

Replaces all deprecated `util.is*()` type-checking methods with their modern equivalents. The codemod handles namespace imports (`util.isArray`), destructured named imports, and removes the `util` import when it becomes unused after the transformation.

The full set of replacements is:

| Deprecated | Replacement |
|---|---|
| `util.isArray(x)` | `Array.isArray(x)` |
| `util.isBoolean(x)` | `typeof x === 'boolean'` |
| `util.isBuffer(x)` | `Buffer.isBuffer(x)` |
| `util.isDate(x)` | `x instanceof Date` |
| `util.isError(x)` | `Error.isError(x)` |
| `util.isFunction(x)` | `typeof x === 'function'` |
| `util.isNull(x)` | `x === null` |
| `util.isNullOrUndefined(x)` | `x === null \|\| x === undefined` |
| `util.isNumber(x)` | `typeof x === 'number'` |
| `util.isObject(x)` | `x && typeof x === 'object'` |
| `util.isPrimitive(x)` | `Object(x) !== x` |
| `util.isRegExp(x)` | `x instanceof RegExp` |
| `util.isString(x)` | `typeof x === 'string'` |
| `util.isSymbol(x)` | `typeof x === 'symbol'` |
| `util.isUndefined(x)` | `typeof x === 'undefined'` |

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/util-is
```

## Examples

### Example 1

Namespace `require` with multiple `util.is*()` calls — the import is removed:

```diff
-const util = require('node:util');
-
-if (util.isArray(someValue)) {
+if (Array.isArray(someValue)) {
   console.log('someValue is an array');
 }
-if (util.isBoolean(someValue)) {
+if (typeof someValue === 'boolean') {
   console.log('someValue is a boolean');
 }
-if (util.isDate(someValue)) {
+if (someValue instanceof Date) {
   console.log('someValue is a date');
 }
-if (util.isNullOrUndefined(someValue)) {
+if (someValue === null || someValue === undefined) {
   console.log('someValue is null or undefined');
 }
-if (util.isPrimitive(someValue)) {
+if (Object(someValue) !== someValue) {
   console.log('someValue is a primitive');
 }
```

### Example 2

Destructured named import — the import is removed:

```diff
-const { isArray, isBoolean } = require('node:util');
-
-if (isArray(someValue)) {
+if (Array.isArray(someValue)) {
   console.log('someValue is an array');
 }
-if (isBoolean(someValue)) {
+if (typeof someValue === 'boolean') {
   console.log('someValue is a boolean');
 }
```

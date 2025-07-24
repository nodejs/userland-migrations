# `util.is**()`

This codemod replaces deprecated `util.is**()` methods with their modern equivalents.

See these deprecations handled by this codemod:
- [DEP0044: `util.isArray()`](https://nodejs.org/docs/latest/api/deprecations.html#DEP0044)
- [DEP0045: `util.isBoolean()`](https://nodejs.org/docs/latest/api/deprecations.html#dep0045-utilisboolean)
- [DEP0046: `util.isBuffer()`](https://nodejs.org/docs/latest/api/deprecations.html#dep0046-utilisbuffer)
- [DEP0047: `util.isDate()`](https://nodejs.org/docs/latest/api/deprecations.html#dep0047-utilisdate)
- [DEP0048: `util.isError()`](https://nodejs.org/docs/latest/api/deprecations.html#dep0048-utiliserror)
- [DEP0049: `util.isFunction()`](https://nodejs.org/docs/latest/api/deprecations.html#dep0049-utilisfunction)
- [DEP0050: `util.isNull()`](https://nodejs.org/docs/latest/api/deprecations.html#dep0050-utilisnull)
- [DEP0051: `util.isNullOrUndefined()`](https://nodejs.org/docs/latest/api/deprecations.html#dep0051-utilisnullorundefined)
- [DEP0052: `util.isNumber()`](https://nodejs.org/docs/latest/api/deprecations.html#dep0052-utilisnumber)
- [DEP0053: `util.isObject()`](https://nodejs.org/docs/latest/api/deprecations.html#dep0053-utilisobject)
- [DEP0054: `util.isPrimitive()`](https://nodejs.org/docs/latest/api/deprecations.html#dep0054-utilisprimitive)
- [DEP0055: `util.isRegExp()`](https://nodejs.org/docs/latest/api/deprecations.html#dep0055-utilisregexp)
- [DEP0056: `util.isString()`](https://nodejs.org/docs/latest/api/deprecations.html#dep0056-utilisstring)
- [DEP0057: `util.isSymbol()`](https://nodejs.org/docs/latest/api/deprecations.html#dep0057-utilissymbol)
- [DEP0058: `util.isUndefined()`](https://nodejs.org/docs/latest/api/deprecations.html#dep0058-utilisundefined)

## Examples

**Before:**

```js
import util from 'node:util';

if (util.isArray(someValue)) {
  console.log('someValue is an array');
}
if (util.isBoolean(someValue)) {
  console.log('someValue is a boolean');
}
if (util.isBuffer(someValue)) {
  console.log('someValue is a buffer');
}
if (util.isDate(someValue)) {
  console.log('someValue is a date');
}
if (util.isError(someValue)) {
  console.log('someValue is an error');
}
if (util.isFunction(someValue)) {
  console.log('someValue is a function');
}
if (util.isNull(someValue)) {
  console.log('someValue is null');
}
if (util.isNullOrUndefined(someValue)) {
  console.log('someValue is null or undefined');
}
if (util.isNumber(someValue)) {
  console.log('someValue is a number');
}
if (util.isObject(someValue)) {
  console.log('someValue is an object');
}
if (util.isPrimitive(someValue)) {
  console.log('someValue is a primitive');
}
if (util.isRegExp(someValue)) {
  console.log('someValue is a regular expression');
}
if (util.isString(someValue)) {
  console.log('someValue is a string');
}
if (util.isSymbol(someValue)) {
  console.log('someValue is a symbol');
}
if (util.isUndefined(someValue)) {
  console.log('someValue is undefined');
}
```

**After:**

```js
if (Array.isArray(someValue)) {
  console.log('someValue is an array');
}
if (typeof someValue === 'boolean') {
  console.log('someValue is a boolean');
}
if (Buffer.isBuffer(someValue)) {
  console.log('someValue is a buffer');
}
if (someValue instanceof Date) {
  console.log('someValue is a date');
}
if (someValue instanceof Error) {
  console.log('someValue is an error');
}
if (typeof someValue === 'function') {
  console.log('someValue is a function');
}
if (someValue === null) {
  console.log('someValue is null');
}
if (someValue == null) {
  console.log('someValue is null or undefined');
}
if (typeof someValue === 'number') {
  console.log('someValue is a number');
}
if (typeof someValue === 'object' && someValue !== null) {
  console.log('someValue is an object');
}
if (someValue !== Object(someValue)) {
  console.log('someValue is a primitive');
}
if (someValue instanceof RegExp) {
  console.log('someValue is a regular expression');
}
if (typeof someValue === 'string') {
  console.log('someValue is a string');
}
if (typeof someValue === 'symbol') {
  console.log('someValue is a symbol');
}
if (typeof someValue === 'undefined') {
  console.log('someValue is undefined');
}
```

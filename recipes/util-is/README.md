# `util.is*()`

This codemod replaces the following deprecated `util.is*()` methods with their modern equivalents:

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

| **Before**                        | **After**                                   |
|-----------------------------------|---------------------------------------------|
| `util.isArray(value)`             | `Array.isArray(value)`                      |
| `util.isBoolean(value)`           | `typeof value === 'boolean'`               |
| `util.isBuffer(value)`            | `Buffer.isBuffer(value)`                   |
| `util.isDate(value)`              | `value instanceof Date`                    |
| `util.isError(value)`             | `Error.isError(value)`                     |
| `util.isFunction(value)`          | `typeof value === 'function'`              |
| `util.isNull(value)`              | `value === null`                           |
| `util.isNullOrUndefined(value)`   | `value === null || value === undefined`    |
| `util.isNumber(value)`            | `typeof value === 'number'`                |
| `util.isObject(value)`            | `value && typeof value === 'object'`       |
| `util.isPrimitive(value)`         | `Object(value) !== value`                  |
| `util.isRegExp(value)`            | `value instanceof RegExp`                  |
| `util.isString(value)`            | `typeof value === 'string'`                |
| `util.isSymbol(value)`            | `typeof value === 'symbol'`                |
| `util.isUndefined(value)`         | `typeof value === 'undefined'`             |

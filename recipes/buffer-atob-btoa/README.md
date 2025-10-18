# Migrate legacy `buffer.atob()` and `buffer.btoa()` APIs

Migrates usage of the legacy APIs `buffer.atob()` and `buffer.btoa()` to the current recommended approaches.

## Example

### Migrating buffer.atob(data)

**Before:**
```js
const buffer = require('node:buffer');
const data = 'SGVsbG8gV29ybGQh'; // "Hello World!" in base64
const decodedData = buffer.atob(data);
console.log(decodedData); // Outputs: Hello World!
```

**After:**
```js
const data = 'SGVsbG8gV29ybGQh'; // "Hello World!" in base64
const decodedData = Buffer.from(data, 'base64').toString('binary');
console.log(decodedData); // Outputs: Hello World!
```

### Migrating buffer.btoa(data)

**Before:**
```js
const buffer = require('node:buffer');
const data = 'Hello World!';
const encodedData = buffer.btoa(data);
console.log(encodedData); // Outputs: SGVsbG8gV29ybGQh
```

**After:**
```js
const data = 'Hello World!';
const encodedData = Buffer.from(data, 'binary').toString('base64');
console.log(encodedData); // Outputs: SGVsbG8gV29ybGQh
```

## REFS
* [Node.js Documentation: Buffer](https://nodejs.org/api/buffer.html)
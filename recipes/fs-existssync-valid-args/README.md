# fs-existssync-valid-args

This codemod validates and converts invalid argument types to `fs.existsSync()`. It's useful to migrate code that passes invalid argument types which now causes deprecation warnings or errors.

## Description

Starting with Node.js, passing invalid argument types to `fs.existsSync()` triggers a deprecation warning (DEP0187). The function should only receive `string`, `Buffer`, or `URL` arguments.

This codemod automatically:
- Validates that `fs.existsSync()` receives valid argument types
- Converts invalid argument types to valid ones where possible
- Handles both CommonJS (`require`) and ESM (`import`) syntax
- Adds type checks or conversions to ensure argument validity

## Examples

### Case 1: Direct Literal Values

**Before:**
```javascript
const fs = require("node:fs");

const exists = fs.existsSync(123);
```

**After:**
```javascript
const fs = require("node:fs");

const exists = fs.existsSync(String(123));
```

### Case 2: Variable Arguments

**Before:**
```javascript
const fs = require("node:fs");

function checkFile(path) {
  return fs.existsSync(path);
}
```

**After:**
```javascript
const fs = require("node:fs");

function checkFile(path) {
  if (typeof path !== 'string' && !Buffer.isBuffer(path) && !(path instanceof URL)) {
    path = String(path);
  }
  return fs.existsSync(path);
}
```

### Case 3: Null Values

**Before:**
```javascript
const fs = require("node:fs");

const fileExists = fs.existsSync(null);
```

**After:**
```javascript
const fs = require("node:fs");

const fileExists = fs.existsSync(String(null || ''));
```

### Case 4: Object Arguments

**Before:**
```javascript
import { existsSync } from "node:fs";

const exists = existsSync({ path: '/some/file' });
```

**After:**
```javascript
import { existsSync } from "node:fs";

const exists = existsSync(String({ path: '/some/file' }));
```

## References

- [DEP0187: Passing invalid argument types to fs.existsSync](https://nodejs.org/api/deprecations.html#dep0187-passing-invalid-argument-types-to-fsexistssync)
- [Node.js fs.existsSync() documentation](https://nodejs.org/api/fs.html#fsexistssyncpath)

## Usage

See the main [README](../../README.md) for usage instructions.


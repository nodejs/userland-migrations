---
authors: vishalrajofficial
---

# DEP0206: Remove Provably Redundant `Hmac.digest()` Calls

Removes redundant, standalone argument-free `hmac.digest()` expression statements on already-finalized Hmac instances created through `crypto.createHmac()`. Supports CommonJS and ESM imports, aliases, and both `crypto` and `node:crypto` specifiers. See [DEP0206](https://nodejs.org/api/deprecations.html#DEP0206).

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/crypto-hmac-digest-redundant
```

## Examples

### Example 1

Adjacent redundant `hmac.digest()` call after finalizing the instance:

```diff
 import { createHmac } from 'node:crypto';

 const hmac = createHmac('sha256', 'secret');
 hmac.update('message');
 const digest = hmac.digest('hex');
-hmac.digest();
 console.log(digest);
```

### Example 2

CommonJS and aliased `createHmac` with standalone calls:

```diff
 const { createHmac: makeHmac } = require('node:crypto');

 const hmac = makeHmac('sha256', 'secret');
 hmac.digest('hex');
-hmac.digest();
```

## Notes

### Limitations

- Only argument-free `hmac.digest()` calls on stable, unescaped local bindings in straight-line code are automatically removed.
- Calls where the return value is consumed (e.g. assigned to a variable or passed as an argument) are left unchanged for manual review, as reusing the first digest changes behavior.
- Repeated calls with arguments or calls occurring across different branches are not modified.

# tls-securepair-to-tlssocket

Codemod to migrate from the deprecated `tls.SecurePair` class to `tls.TLSSocket` in Node.js applications. `SecurePair` was deprecated and subsequently removed in favor of `TLSSocket`.

## What it does

This codemod transforms usages of `tls.SecurePair` into `tls.TLSSocket`. Since `TLSSocket` wraps an existing socket, the codemod injects a `socket` argument that you may need to define or bind in your context.

Key transformations:
- **Constructor:** Replaces `new SecurePair()` with `new TLSSocket(socket)`.
- **Imports:** Updates `require` and `import` statements from `SecurePair` to `TLSSocket`.
- **Renaming:** Intelligently renames variables (e.g., `pair` → `socket`, `securePairInstance` → `socketInstance`) while preserving CamelCase.
- **Cleanup:** Removes deprecated property accesses like `.cleartext` and `.encrypted`.
- **Annotations:** Adds comments to highlight where manual API verification is needed.

## Supports

- **Module Systems:**
  - CommonJS: `const tls = require('node:tls')` / `const { SecurePair } = ...`
  - ESM: `import tls from 'node:tls'` / `import { SecurePair } ...`
- **Variable Renaming:**
  - Updates variable declarations: `const pair = ...` → `const socket = ...`
  - Updates references deep in the scope: `pair.on('error')` → `socket.on('error')`
  - Handles naming variations: `myPair` → `mySocket`, `securePair` → `secureSocket`.
- **Cleanup:**
  - Identifies and removes lines accessing `cleartext` or `encrypted` properties.
- **Namespace Handling:**
  - Supports both `new tls.SecurePair()` and `new SecurePair()`.

## Examples

### Case 1: CommonJS & Variable Renaming

**Before**

```js
const tls = require('node:tls');

// Using tls.SecurePair constructor
const pair = new tls.SecurePair();
const cleartext = pair.cleartext;
const encrypted = pair.encrypted;

pair.on('error', (err) => {
  console.error(err);
});
```

**After**

```
const tls = require('node:tls');

// Using tls.TLSSocket instead
const socket = new tls.TLSSocket(socket);
// Note: Direct migration may require additional context-specific changes
// as SecurePair and TLSSocket have different APIs

socket.on('error', (err) => {
  console.error(err);
});
```

### Case 2: ESM & Destructuring

**Before**

```
import { SecurePair } from 'node:tls';

const myPair = new SecurePair();
myPair.cleartext.write('hello');
```

**After**

```
import { TLSSocket } from 'node:tls';

const mySocket = new TLSSocket(socket);
// Note: Direct migration may require additional context-specific changes
// as SecurePair and TLSSocket have different APIs
```

## Warning

The tls.TLSSocket constructor requires an existing socket instance (net.Socket) as an argument. This codemod automatically inserts socket as the argument:
JavaScript

```
new TLSSocket(socket)
```

You must ensure that a variable named socket exists in the scope or rename it to match your existing socket variable (e.g., clientSocket, stream, etc.).

## Test

The test.sh script runs all the tests located in the tests folder. All input files are temporarily copied to a new folder and compared against their expected results found in the expected folder. This helps identify which tests failed and why. Feel free to add new tests if necessary.
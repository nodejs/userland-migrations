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

### Case 1: CommonJS with namespace access

```diff
  const tls = require('node:tls');
  
- const pair = new tls.SecurePair();
- const encrypted = pair.encrypted;
+ const socket = new tls.TLSSocket(socket);
```

### Case 2: ESM with destructuring

```diff
- import { SecurePair } from 'node:tls';
+ import { TLSSocket } from 'node:tls';
  
- const myPair = new SecurePair();
- myPair.cleartext.write('hello');
+ const mySocket = new TLSSocket(socket);
+ mySocket.write('hello');
```

### Case 3: Variable renaming across scope

```diff
  const tls = require('node:tls');
  
- const securePair = new tls.SecurePair();
+ const secureSocket = new tls.TLSSocket(socket);
  
- securePair.on('error', (err) => {
+ secureSocket.on('error', (err) => {
    console.error(err);
  });
```

### Case 4: Multiple variables with cleanup

```diff
- const { SecurePair } = require('node:tls');
+ const { TLSSocket } = require('node:tls');
  
- const pair = new SecurePair();
- const cleartext = pair.cleartext;
+ const socket = new TLSSocket(socket);
```

## Warning

The tls.TLSSocket constructor requires an existing socket instance (net.Socket) as an argument. This codemod automatically inserts socket as the argument:
JavaScript

```js
```
new TLSSocket(socket)
```

You must ensure that a variable named socket exists in the scope or rename it to match your existing socket variable (e.g., clientSocket, stream, etc.).

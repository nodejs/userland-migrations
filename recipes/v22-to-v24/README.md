---
authors: AugustinMauroy
---

# Node.js v22 to v24 Migration

Meta-recipe that composes the individual migration codemods from this repository needed to upgrade a codebase from Node.js v22 to v24, replacing deprecated APIs with their modern equivalents in a single run. See the [official v22 to v24 migration guide](https://nodejs.org/en/blog/migrations/v22-to-v24) for the full list of changes in Node.js v24.

> [!WARNING]
> This codemod is on `v0.0.X` because there are missing parts, so be careful before pushing changes to production. If you find any missing migration, please open an issue or a PR. The known missing pieces are tracked in [nodejs/userland-migrations#239](https://github.com/nodejs/userland-migrations/issues/239).

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/v22-to-v24
```

## Included codemods

Running this recipe applies the following codemods from the Codemod Registry, in order:

| Codemod | What it migrates |
| ------- | ---------------- |
| [`@nodejs/dirent-path-to-parent-path`](/learn/userland-migrations/dirent-path-to-parent-path) | DEP0178: `dirent.path` to `dirent.parentPath` |
| [`@nodejs/fs-access-mode-constants`](/learn/userland-migrations/fs-access-mode-constants) | DEP0176: `fs.F_OK`, `fs.R_OK`, `fs.W_OK`, `fs.X_OK` to `fs.constants` |
| [`@nodejs/fs-truncate-fd-deprecation`](/learn/userland-migrations/fs-truncate-fd-deprecation) | DEP0081: `fs.truncate()` with a file descriptor to the `ftruncate` family |
| [`@nodejs/http-outgoingmessage-headers`](/learn/userland-migrations/http-outgoingmessage-headers) | DEP0066: `OutgoingMessage.prototype._headers` and `_headerNames` to public header APIs |
| [`@nodejs/http2-priority-signaling`](/learn/userland-migrations/http2-priority-signaling) | DEP0194: removes HTTP/2 priority-related options and methods |
| [`@nodejs/timers-deprecations`](/learn/userland-migrations/timers-deprecations) | DEP0095/DEP0096/DEP0126/DEP0127: deprecated `node:timers` APIs to public timer functions |
| [`@nodejs/tls-create-secure-pair-to-tls-socket`](/learn/userland-migrations/tls-create-secure-pair-to-tls-socket) | DEP0064: `tls.createSecurePair()` to `tls.TLSSocket` |
| [`@nodejs/util-is`](/learn/userland-migrations/util-is) | Deprecated `util.is*()` type checks to their modern equivalents |
| [`@nodejs/util-log-to-console-log`](/learn/userland-migrations/util-log-to-console-log) | DEP0059: `util.log()` to `console.log()` |

## Examples

### Deprecated `util.is*()` type checks

Applied by `@nodejs/util-is`; the unused `node:util` binding is removed once no other usage remains.

```diff
-const util = require('node:util');

-if (util.isArray(someValue)) {
+if (Array.isArray(someValue)) {
   console.log('someValue is an array');
 }
-if (util.isDate(someValue)) {
+if (someValue instanceof Date) {
   console.log('someValue is a date');
 }
-if (util.isString(someValue)) {
+if (typeof someValue === 'string') {
   console.log('someValue is a string');
 }
```

### `util.log()` to `console.log()`

Applied by `@nodejs/util-log-to-console-log`, preserving the timestamp behavior of `util.log()`.

```diff
-const util = require("node:util");

-util.log("Hello world");
+console.log(new Date().toLocaleString(), "Hello world");
```

<!-- sync_to_learn: false -->

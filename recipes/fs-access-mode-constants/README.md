---
authors: nekojanai
---

# DEP0176: fs.F_OK / fs.R_OK / fs.W_OK / fs.X_OK fs.constants.\*

Moves the deprecated `fs.F_OK`, `fs.R_OK`, `fs.W_OK`, and `fs.X_OK` access mode constants to their canonical location under `fs.constants`. Handles both `require` and `import` syntax, updating destructured bindings to import `constants` instead and rewriting all usages at their call sites.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/fs-access-mode-constants
```

## Examples

### Example 1

Namespace `require` — constant references on the `fs` object are prefixed with `.constants`.

```diff
 const fs = require('node:fs');

-fs.access('/path/to/file', fs.F_OK, callback);
-fs.access('/path/to/file', fs.R_OK | fs.W_OK, callback);
+fs.access('/path/to/file', fs.constants.F_OK, callback);
+fs.access('/path/to/file', fs.constants.R_OK | fs.constants.W_OK, callback);
```

### Example 2

Destructured `require` — individual constant bindings are replaced with `constants`, and usages are prefixed accordingly.

```diff
-const { access, F_OK, R_OK, W_OK } = require('node:fs');
+const { access, constants } = require('node:fs');

-access('/path/to/file', F_OK, callback);
-access('/path/to/file', R_OK | W_OK, callback);
+access('/path/to/file', constants.F_OK, callback);
+access('/path/to/file', constants.R_OK | constants.W_OK, callback);
```

### Example 3

Named `import` — constant specifiers are replaced with `constants`, and usages are updated.

```diff
-import { access, F_OK, R_OK, W_OK, X_OK } from 'node:fs';
+import { access, constants } from 'node:fs';

-access('/path/to/file', F_OK, callback);
-access('/path/to/file', R_OK | W_OK | X_OK, callback);
+access('/path/to/file', constants.F_OK, callback);
+access('/path/to/file', constants.R_OK | constants.W_OK | constants.X_OK, callback);
```

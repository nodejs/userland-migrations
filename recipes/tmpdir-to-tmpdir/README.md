---
authors: nekojanai
---

# DEP0022: os.tmpDir() os.tmpdir()

Renames the deprecated `os.tmpDir()` function to `os.tmpdir()`. This is a case-sensitive rename that applies to both the imported binding name and all call sites.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/tmpDir-to-tmpdir
```

## Examples

### Example 1

Updating a `require` import and its call sites:

```diff
-const { tmpDir } = require('os');
+const { tmpdir } = require('os');

-var t0 = tmpDir();
-let t1 = tmpDir();
-const t2 = tmpDir();
+var t0 = tmpdir();
+let t1 = tmpdir();
+const t2 = tmpdir();
```

### Example 2

Updating a `require` import using the `node:` protocol:

```diff
-const { tmpDir } = require('node:os');
+const { tmpdir } = require('node:os');

-var t0 = tmpDir();
-let t1 = tmpDir();
-const t2 = tmpDir();
+var t0 = tmpdir();
+let t1 = tmpdir();
+const t2 = tmpdir();
```

### Example 3

Updating an aliased destructuring import:

```diff
-const { tmpDir: tmpdir } = require('node:os');
+const { tmpdir: tmpdir } = require('node:os');
```

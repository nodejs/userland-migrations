---
authors: AugustinMauroy
---

# DEP0147: fs.rmdir() fs.rm()

Converts `fs.rmdir(path, { recursive: true })` calls to `fs.rm(path, { recursive: true, force: true })`. Also handles the synchronous variant (`fs.rmdirSync` → `fs.rmSync`), the promises variant (`fs.promises.rmdir` → `fs.promises.rm`), destructured imports, and aliased imports. The `force: true` option is always added alongside `recursive: true`.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/rmdir
```

## Examples

### Example 1

Namespace `require` — all three API shapes are migrated, untouched calls are left alone:

```diff
const fs = require("node:fs");

const pathName = "path/to/directory";

-fs.rmdir(pathName, { recursive: true }, () => { });
+fs.rm(pathName, { recursive: true, force: true }, () => { });
-fs.rmdirSync(pathName, { recursive: true });
+fs.rmSync(pathName, { recursive: true, force: true });
-fs.promises.rmdir(pathName, { recursive: true });
+fs.promises.rm(pathName, { recursive: true, force: true });
fs.rmdir(pathName, { recursive: false }); // should not be transformed
fs.rmdir(pathName); // should not be transformed
```

### Example 2

Destructured `require` — `rm` is added to the destructured bindings and calls are updated:

```diff
-const { rmdir, rmdirSync, promises } = require("node:fs");
+const { rm, rmdir, rmSync, promises } = require("node:fs");

const pathName = "path/to/directory";

-rmdir(pathName, { recursive: true }, () => { });
+rm(pathName, { recursive: true, force: true }, () => { });
-rmdirSync(pathName, { recursive: true });
+rmSync(pathName, { recursive: true, force: true });
-promises.rmdir(pathName, { recursive: true });
+promises.rm(pathName, { recursive: true, force: true });
rmdir(pathName, { recursive: false }); // should not be transformed
rmdir(pathName); // should not be transformed
```

### Example 3

Aliased ESM import — the imported name is changed from `rmdir` to `rm`:

```diff
-import { rmdir as foo } from "node:fs";
+import { rm as foo } from "node:fs";

const pathName = "path/to/directory";

foo(pathName, { recursive: true }, () => {});
```

## Notes

### Limitations

Only calls that include `{ recursive: true }` in the options argument are transformed. Calls to `fs.rmdir` without that option are left untouched, as they do not trigger the deprecation.

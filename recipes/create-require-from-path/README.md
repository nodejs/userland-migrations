---
authors: AugustinMauroy
---

# DEP0130: module.createRequireFromPath() module.createRequire()

Replaces the deprecated `createRequireFromPath` function with `createRequire` from the `module` package. Updates both the import/require declaration and all call sites, including aliased imports.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/create-require-from-path
```

## Examples

### Example 1

CommonJS require

```diff
-const { createRequireFromPath } = require('module');
+const { createRequire } = require('module');

-const require = createRequireFromPath('/path/to/module')
+const require = createRequire('/path/to/module')
 const myModule = require('./myModule.cjs');
```

### Example 2

ESM named import

```diff
-import { createRequireFromPath } from 'module';
+import { createRequire } from 'module';

-const require = createRequireFromPath(import.meta.url);
+const require = createRequire(import.meta.url);
 const data = require('./data.json');
```

### Example 3

Aliased import — the alias is preserved; only the imported name changes.

```diff
-import { other as bar, createRequireFromPath as foo } from "../index.mjs";
+import { other as bar, createRequire as foo } from "../index.mjs";

 const r3 = foo("/path/to/module");
```

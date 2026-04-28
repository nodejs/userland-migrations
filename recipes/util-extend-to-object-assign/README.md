---
authors: AugustinMauroy
---

# DEP0060: util.\_extend() Object.assign()

Replaces the deprecated `util._extend(target, source)` with `Object.assign(target, source)`. The codemod handles namespace imports (`util._extend`), destructured named imports (`const { _extend } = require('util')`), and aliased imports. The `util` import is removed when it becomes unused after the transformation.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/util-extend-to-object-assign
```

## Examples

### Example 1

Namespace `require` — the import is removed because `util` is no longer used:

```diff
-const util = require('util');
 const a = { x: 1 };
 const b = { y: 2 };
-util._extend(a, b);
+Object.assign(a, b);
```

### Example 2

Default ESM import — the import is removed:

```diff
-import util from 'node:util';
-util._extend({}, {});
+Object.assign({}, {});
```

### Example 3

Destructured named import — the import is removed:

```diff
-const { _extend } = require('util');
-_extend({}, {});
+Object.assign({}, {});
```

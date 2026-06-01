---
authors: AugustinMauroy
---

# DEP0191: repl.builtinModules / repl.\_builtinLibs module.builtinModules

Replaces deprecated access to `repl.builtinModules` and `repl._builtinLibs` with `module.builtinModules` from `node:module`. Handles namespace requires, destructured requires (including aliased), ESM named imports, and dynamic imports. Both property names are normalized to `builtinModules` in all cases.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/repl-builtin-modules
```

## Examples

### Example 1

Namespace `require` — the variable is renamed to `module` and all accesses (including `_builtinLibs`) are updated:

```diff
-const repl = require('node:repl');
+const module = require('node:module');

-console.log(repl.builtinModules);
-console.log(repl._builtinLibs);
+console.log(module.builtinModules);
+console.log(module.builtinModules);
```

### Example 2

Destructured `require` with an aliased builtin property — only the module specifier changes:

```diff
-const { builtinModules: nodeBuiltinModules } = require('node:repl');
+const { builtinModules: nodeBuiltinModules } = require('node:module');

console.log(nodeBuiltinModules);
```

### Example 3

Mixed named ESM import — the builtin specifier is split into a new import from `node:module`, and `_builtinLibs` references are renamed to `builtinModules`:

```diff
-import { builtinModules, _builtinLibs, foo } from 'node:repl';
+import { foo } from 'node:repl';
+import { builtinModules } from 'node:module';

-console.log(builtinModules);
-console.log(_builtinLibs);
+console.log(builtinModules);
+console.log(builtinModules);

foo(); // does something else
```

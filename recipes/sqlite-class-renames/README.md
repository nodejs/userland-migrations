---
authors: FrustratedBoy420
---

# DEP0210 and DEP0211: `node:sqlite` class renames

Node.js 26.11.0 renamed two classes exported by `node:sqlite`. `DatabaseSync` became `Database` ([DEP0210](https://nodejs.org/api/deprecations.html#DEP0210)) and `StatementSync` became `Statement` ([DEP0211](https://nodejs.org/api/deprecations.html#DEP0211)). The old names remain as documentation-deprecated aliases. The APIs are still synchronous.

This codemod migrates imports and references that resolve to `node:sqlite`. It supports ESM named, namespace, and default imports, CommonJS destructuring and property access, aliases, `await import('node:sqlite')`, re-exports, and TypeScript type annotations. Run it only on projects whose supported Node.js versions include 26.11.0 or later.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/sqlite-class-renames
```

## Examples

### Named imports and references

```diff
-import { DatabaseSync, StatementSync } from 'node:sqlite';
+import { Database, Statement } from 'node:sqlite';

-const db = new DatabaseSync(':memory:');
+const db = new Database(':memory:');
 const statement = db.prepare('SELECT 1');
-console.log(statement instanceof StatementSync);
+console.log(statement instanceof Statement);
```

### Explicit aliases are kept

```diff
-const { DatabaseSync: DB } = require('node:sqlite');
+const { Database: DB } = require('node:sqlite');

 const db = new DB(':memory:');
```

### Public export names are kept

```diff
-export { DatabaseSync } from 'node:sqlite';
+export { Database as DatabaseSync } from 'node:sqlite';
```

### Name collisions and shadowing

When the new name is already used in the file, or the old name is declared again (for example as a parameter), the codemod keeps the old local name as an alias. Other code in the file does not change.

```diff
 import Database from 'better-sqlite3';
-import { DatabaseSync } from 'node:sqlite';
+import { Database as DatabaseSync } from 'node:sqlite';

 const db = new DatabaseSync(':memory:');
```

## Limitations

- Third-party packages such as `sqlite` or `better-sqlite3` are not changed. Only the `node:sqlite` specifier is resolved, because `sqlite` without the prefix is not a Node.js built-in.
- If the variable that holds the whole module (for example `sqlite` in `import * as sqlite`) is declared again in the file, its member accesses are left unchanged and a warning is printed.
- Computed access such as `sqlite['DatabaseSync']` and `import('node:sqlite').then(...)` callbacks are not changed.
- Type-only imports (`import type { DatabaseSync }` and inline `import { type DatabaseSync }`) are not changed. The old names still work as deprecated aliases.

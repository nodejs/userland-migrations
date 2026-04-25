# `@nodejs/codemod-utils`

This is a local package, which means it isn’t published to the npm registry and is only used within the monorepo.

## Why Use These Utilities?

Building Node.js codemods with [ast-grep](https://ast-grep.github.io/) requires handling complex patterns for:

- **Import/Require Analysis**: Finding and analyzing `import` statements and `require()` calls for specific modules
- **Binding Resolution**: Determining how imported functions are accessed locally (destructured, aliased, etc.)
- **Code Transformation**: Safely removing unused imports and modifying code while preserving formatting
- **Package.json Processing**: Analyzing and transforming `package.json` scripts that use Node.js

These utilities provide battle-tested solutions for common codemod operations, reducing boilerplate and ensuring consistent behavior across all migration recipes.

## Package Utilities

### `removeDependencies(dependenciesToRemove, options?)`

Removes dependencies from `dependencies` and `devDependencies` in `package.json`, then optionally runs the detected package manager install command.

```typescript
import removeDependencies from '@nodejs/codemod-utils/remove-dependencies';

await removeDependencies(['chalk', 'lodash'], {
  runInstall: false,
});
```

#### Parameters

- `dependenciesToRemove`: `string | string[]` — package name(s) to remove.
- `options.packageJsonPath`: optional path to a target `package.json` (default: `package.json`).
- `options.runInstall`: set to `false` to skip install after changes (default: `true`).
- `options.persistFileWrite`: set to `false` to preview returned JSON without writing to disk (default: `true`).

#### Return value

- Returns updated `package.json` content as a string when changes are applied.
- Returns `null` when there is nothing to remove, no `package.json`, or on parsing/runtime failure.

#### Notes

- Package manager detection order: `packageJson.packageManager` → lockfiles (`pnpm-lock.yaml`, `yarn.lock`) → `npm`.
- When `runInstall` is enabled, runs `<package-manager> install` in the package directory.

## AST-grep Utilities

### Import and Require Detection

#### `getModuleDependencies(rootNode, nodeModuleName)`

Finds all module import/require statements for a specific Node.js module.
Under the hood, calls `getNodeRequireCalls`, `getNodeImportStatements`, `getNodeImportCalls`, and
combines the return values.

```typescript
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';

// Finds: import fs from 'fs'; import { readFile } from 'node:fs';
// Finds: const fs = require('fs')
// Finds: const fs = await import('fs')
const fsImports = getModuleDependencies(ast, 'fs');
```

#### `getNodeImportStatements(rootNode, nodeModuleName)`

Finds all ES module import statements for a specific Node.js module.

```typescript
import { getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';

// Finds: import fs from 'fs'; import { readFile } from 'node:fs';
const fsImports = getNodeImportStatements(ast, 'fs');
```

#### `getNodeImportCalls(rootNode, nodeModuleName)`

Finds dynamic import calls assigned to variables (excludes unassigned imports).

```typescript
import { getNodeImportCalls } from '@nodejs/codemod-utils/ast-grep/import-statement';

// Finds: const fs = await import('node:fs');
// Ignores: import('node:fs'); // unassigned
const fsImportCalls = getNodeImportCalls(ast, 'fs');
```

#### `getNodeRequireCalls(rootNode, nodeModuleName)`

Finds CommonJS require calls assigned to variables.

```typescript
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';

// Finds: const fs = require('fs'); const { readFile } = require('node:fs');
const fsRequires = getNodeRequireCalls(ast, 'fs');
```

### Binding Resolution and Transformation

#### `resolveBindingPath(node, path)`

Resolves how a global API path should be accessed based on the import pattern.

```typescript
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';

// Given: const { types } = require('node:util');
// resolveBindingPath(node, '$.types.isNativeError') → 'types.isNativeError'

// Given: const util = require('node:util');
// resolveBindingPath(node, '$.types.isNativeError') → 'util.types.isNativeError'

// Given: import { types as utilTypes } from 'node:util';
// resolveBindingPath(node, '$.types.isNativeError') → 'utilTypes.isNativeError'
```

#### `removeBinding(node, binding)`

Removes a specific binding from imports/requires, or removes the entire statement if it's the only binding.

```typescript
import { removeBinding } from '@nodejs/codemod-utils/ast-grep/remove-binding';

// Given: const { types, isNativeError } = require('node:util');
// removeBinding(node, 'isNativeError') → Edit to: const { types } = require('node:util');

// Given: const { isNativeError } = require('node:util');
// removeBinding(node, 'isNativeError') → Returns line range to remove entire statement

// Given: const util = require('node:util');
// removeBinding(node, 'util') → Returns line range to remove entire statement
```

#### `updateBinding(node, { old, new })`

Updates a specific binding from imports/requires. It can be used to replace, add, or remove bindings.

```typescript
import { updateBinding } from '@nodejs/codemod-utils/ast-grep/update-binding';

// Given: const { isNativeError } = require('node:util');
// updateBinding(node, {old: 'isNativeError', new: 'types'}) → Edit to: const { types } = require('node:util');

// Given: const { isNativeError } = require('node:util');
// updateBinding(node, {old: undefined, new: 'types'}) → Edit to: const { isNativeError, types } = require('node:util');

// Given: const { isNativeError, types } = require('node:util');
// updateBinding(node, {old: isNativeError, new: undefined}) → Works exactly as removeBinding util: const { types } = require('node:util');
```

### Code Manipulation

#### `removeLines(sourceCode, ranges)`

Safely removes multiple line ranges from source code, handling overlaps and duplicates.

```typescript
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';

const ranges = [
  { start: { line: 5, column: 0 }, end: { line: 5, column: 50 } },
  { start: { line: 12, column: 0 }, end: { line: 14, column: 0 } }
];

const cleanedCode = removeLines(sourceCode, ranges);
```

### Package.json Utilities

#### `getScriptsNode(packageJsonRootNode)`

Finds the "scripts" section in a package.json AST.

```typescript
import { getScriptsNode } from '@nodejs/codemod-utils/ast-grep/package-json';

const scriptsNodes = getScriptsNode(packageJsonAst);
```

#### `getNodeJsUsage(packageJsonRootNode)`

Finds all references to `node` or `node.exe` in package.json scripts.

```typescript
import { getNodeJsUsage } from '@nodejs/codemod-utils/ast-grep/package-json';

// Finds scripts like: "start": "node server.js", "build": "node.exe build.js"
const nodeUsages = getNodeJsUsage(packageJsonAst);
```

### Additional AST-grep Helpers

#### `detectIndentUnit(source)`

Detects the indentation unit used in source code (`\t` or spaces).

```typescript
import { detectIndentUnit } from '@nodejs/codemod-utils/ast-grep/indent';

const indentUnit = detectIndentUnit(sourceCode);
```

#### `getLineIndent(source, index)`

Returns the indentation prefix for the line containing the given character index.

```typescript
import { getLineIndent } from '@nodejs/codemod-utils/ast-grep/indent';

const indent = getLineIndent(sourceCode, node.range().start.index);
```

#### `getShebang(rootNode)`

Returns the Node.js shebang line node when present (for example `#!/usr/bin/env node`).

```typescript
import { getShebang } from '@nodejs/codemod-utils/ast-grep/shebang';

const shebang = getShebang(ast);
```

#### `getScope(node, customParent?)`

Finds the enclosing scope for a node (e.g., `statement_block` or `program`).

```typescript
import { getScope } from '@nodejs/codemod-utils/ast-grep/get-scope';

const scope = getScope(node);
```

#### `getDefaultImportIdentifier(importNode)`

Returns the identifier node for a default `import` (e.g., `import fs from 'fs'`).

```typescript
import { getDefaultImportIdentifier } from '@nodejs/codemod-utils/ast-grep/import-statement';

const id = getDefaultImportIdentifier(importNode);
```

#### `getRequireNamespaceIdentifier(requireNode)`

Returns the identifier node for namespace-style `require` (e.g., `const util = require('util')`).

```typescript
import { getRequireNamespaceIdentifier } from '@nodejs/codemod-utils/ast-grep/require-call';

const id = getRequireNamespaceIdentifier(varDeclaratorNode);
```

#### `replaceNodeJsArgs(rootNode, argsToValues)` (shebang)

Replaces Node.js arguments in shebang lines.

```typescript
import { replaceNodeJsArgs as replaceShebangNodeJsArgs } from '@nodejs/codemod-utils/ast-grep/shebang';

const edits = replaceShebangNodeJsArgs(ast, { '--inspect': '' });
```

#### `replaceNodeJsArgs(packageJsonRootNode, argsToValues)`

Replaces Node.js script arguments in `package.json` scripts. Useful for normalizing or
rewriting CLI arguments used with `node`.

```typescript
import { replaceNodeJsArgs as replacePackageJsonNodeJsArgs } from '@nodejs/codemod-utils/ast-grep/package-json';

const edits = replacePackageJsonNodeJsArgs(packageJsonAst, { '--inspect': '' });
```

#### `removeNodeJsArgs(packageJsonRootNode, argsToRemove)`

Removes specified arguments from Node.js script usages in `package.json`.

```typescript
import { removeNodeJsArgs } from '@nodejs/codemod-utils/ast-grep/package-json';

const edits = removeNodeJsArgs(packageJsonAst, ['--inspect']);
```

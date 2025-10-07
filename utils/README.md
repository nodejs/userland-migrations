# `@nodejs/codemod-utils`

This is a local package, it's mean it's not published to npm registry it's only used in the monorepo.

## Why Use These Utilities?

Building Node.js codemods with [ast-grep](https://ast-grep.github.io/) requires handling complex patterns for:

- **Import/Require Analysis**: Finding and analyzing `import` statements and `require()` calls for specific modules
- **Binding Resolution**: Determining how imported functions are accessed locally (destructured, aliased, etc.)
- **Code Transformation**: Safely removing unused imports and modifying code while preserving formatting
- **Package.json Processing**: Analyzing and transforming `package.json` scripts that use Node.js

These utilities provide battle-tested solutions for common codemod operations, reducing boilerplate and ensuring consistent behavior across all migration recipes.

## AST-grep Utilities

### Import and Require Detection

#### `getNodeImportStatements(rootNode, nodeModuleName)`

Finds all ES module import statements for a specific Node.js module.

```typescript
import { getNodeImportStatements } from '@nodejs/codemod-utils';

// Finds: import fs from 'fs'; import { readFile } from 'node:fs';
const fsImports = getNodeImportStatements(ast, 'fs');
```

#### `getNodeImportCalls(rootNode, nodeModuleName)`

Finds dynamic import calls assigned to variables (excludes unassigned imports).

```typescript
import { getNodeImportCalls } from '@nodejs/codemod-utils';

// Finds: const fs = await import('node:fs');
// Ignores: import('node:fs'); // unassigned
const fsImportCalls = getNodeImportCalls(ast, 'fs');
```

#### `getNodeRequireCalls(rootNode, nodeModuleName)`

Finds CommonJS require calls assigned to variables.

```typescript
import { getNodeRequireCalls } from '@nodejs/codemod-utils';

// Finds: const fs = require('fs'); const { readFile } = require('node:fs');
const fsRequires = getNodeRequireCalls(ast, 'fs');
```

### Binding Resolution and Transformation

#### `resolveBindingPath(node, path)`

Resolves how a global API path should be accessed based on the import pattern.

```typescript
import { resolveBindingPath } from '@nodejs/codemod-utils';

// Given: const { types } = require('node:util');
// resolveBindingPath(node, '$.types.isNativeError') → 'types.isNativeError'

// Given: const util = require('node:util');
// resolveBindingPath(node, '$.types.isNativeError') → 'util.types.isNativeError'

// Given: import { types as utilTypes } from 'node:util';
// resolveBindingPath(node, '$.types.isNativeError') → 'utilTypes.isNativeError'
```

#### `removeBinding(node, binding)`

Removes a specific binding from destructured imports/requires, or removes the entire statement if it's the only binding.

```typescript
import { removeBinding } from '@nodejs/codemod-utils';

// Given: const { types, isNativeError } = require('node:util');
// removeBinding(node, 'isNativeError') → Edit to: const { types } = require('node:util');

// Given: const { isNativeError } = require('node:util');
// removeBinding(node, 'isNativeError') → Returns line range to remove entire statement
```

### Code Manipulation

#### `removeLines(sourceCode, ranges)`

Safely removes multiple line ranges from source code, handling overlaps and duplicates.

```typescript
import { removeLines } from '@nodejs/codemod-utils';

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
import { getScriptsNode } from '@nodejs/codemod-utils';

const scriptsNodes = getScriptsNode(packageJsonAst);
```

#### `getNodeJsUsage(packageJsonRootNode)`

Finds all references to `node` or `node.exe` in package.json scripts.

```typescript
import { getNodeJsUsage } from '@nodejs/codemod-utils';

// Finds scripts like: "start": "node server.js", "build": "node.exe build.js"
const nodeUsages = getNodeJsUsage(packageJsonAst);
```

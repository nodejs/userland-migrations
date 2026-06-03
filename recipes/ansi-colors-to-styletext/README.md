# ansi-colors to util.styleText

Migrates `ansi-colors` usage to Node.js's built-in `util.styleText` API. Requires Node.js v20.12 or later.

## Example

Before:
```js
const ac = require('ansi-colors');
console.log(ac.red('Error message'));
```

After:
```js
const { styleText } = require('node:util');
console.log(styleText('red', 'Error message'));
```

## What gets transformed

- Default imports — `ac.red(text)` → `styleText('red', text)`
- Destructured imports — `const { red } = require('ansi-colors')` → `const { styleText } = require('node:util')`
- ESM imports — `import ac from 'ansi-colors'` → `import { styleText } from 'node:util'`
- Chained styles — `ac.bold.red(text)` → `styleText(['bold', 'red'], text)`
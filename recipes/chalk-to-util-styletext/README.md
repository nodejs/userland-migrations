# Chalk to util.styleText

This recipe migrates from the external `chalk` package to Node.js built-in `util.styleText` API. It transforms chalk method calls to use the native Node.js styling functionality.

## Examples

**Before:**
```js
import chalk from 'chalk';

console.log(chalk.red('Error message'));
console.log(chalk.green('Success message'));
console.log(chalk.blue('Info message'));
```

**After:**
```js
import { styleText } from 'node:util';

console.log(styleText('red', 'Error message'));
console.log(styleText('green', 'Success message'));
console.log(styleText('blue', 'Info message'));
```

**Before:**
```js
import chalk from 'chalk';

console.log(chalk.red.bold('Important error'));
console.log(chalk.green.underline('Success with emphasis'));
```

**After:**
```js
import { styleText } from 'node:util';

console.log(styleText(['red', 'bold'], 'Important error'));
console.log(styleText(['green', 'underline'], 'Success with emphasis'));
```

**Before:**
```js
const chalk = require('chalk');

const red = chalk.red;
const boldBlue = chalk.blue.bold;

console.log(red('Error'));
console.log(boldBlue('Info'));
```

**After:**
```js
const { styleText } = require('node:util');

const red = (text) => styleText('red', text);
const boldBlue = (text) => styleText(['blue', 'bold'], text);

console.log(red('Error'));
console.log(boldBlue('Info'));
```

## Usage

Run this codemod with:

```sh
npx codemod nodejs/chalk-to-util-styletext
```

## Compatibility

- **Removes chalk dependency** from package.json automatically
- **Supports most chalk methods**: colors, background colors, and text modifiers
- **Unsupported methods**: `hex()`, `rgb()`, `ansi256()`, `bgAnsi256()`, `visible()` (warnings will be shown)

## Limitations

- **Complex conditional expressions** in some contexts may need manual review

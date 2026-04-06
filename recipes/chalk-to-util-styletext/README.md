# Chalk to util.styleText

This recipe migrates from the external `chalk` package to Node.js built-in `util.styleText` API. It transforms chalk method calls to use the native Node.js styling functionality.

## Examples

```diff
- import chalk from 'chalk';
+ import { styleText } from 'node:util';
- console.log(chalk.red('Error message'));
+ console.log(styleText('red', 'Error message'));
- console.log(chalk.green('Success message'));
+ console.log(styleText('green', 'Success message'));
- console.log(chalk.blue('Info message'));
+ console.log(styleText('blue', 'Info message'));
```

```diff
- import chalk from 'chalk';
+ import { styleText } from 'node:util';
- console.log(chalk.red.bold('Important error'));
+ console.log(styleText(['red', 'bold'], 'Important error'));
- console.log(chalk.green.underline('Success with emphasis'));
+ console.log(styleText(['green', 'underline'], 'Success with emphasis'));
```

```diff
- const chalk = require('chalk');
+ const { styleText } = require('node:util');
- const red = chalk.red;
+ const red = (text) => styleText('red', text);
- const boldBlue = chalk.blue.bold;
+ const boldBlue = (text) => styleText(['blue', 'bold'], text);
- console.log(red('Error'));
+ console.log(red('Error'));
- console.log(boldBlue('Info'));
+ console.log(boldBlue('Info'));
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

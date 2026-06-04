# ansi-colors to util.styleText

This recipe migrates from the external `ansi-colors` package to Node.js's built-in `util.styleText` API. It transforms ansi-colors method calls to use the native Node.js styling functionality.

## Examples

```diff
- import ac from 'ansi-colors';
+ import { styleText } from 'node:util';
- console.log(ac.red('Error message'));
+ console.log(styleText('red', 'Error message'));
- console.log(ac.green('Success message'));
+ console.log(styleText('green', 'Success message'));
```

```diff
- const ac = require('ansi-colors');
+ const { styleText } = require('node:util');
- console.log(ac.bold.red('Critical error'));
+ console.log(styleText(['bold', 'red'], 'Critical error'));
```

```diff
- const { red, blue } = require('ansi-colors');
+ const { styleText } = require('node:util');
- console.log(red('Error'));
+ console.log(styleText('red', 'Error'));
- console.log(blue('Info'));
+ console.log(styleText('blue', 'Info'));
```

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/ansi-colors-to-styletext
```

## Compatibility

- **Removes ansi-colors dependency** from package.json automatically
- **Supports all ansi-colors methods**: colors, background colors, text modifiers, and chained styles
- **Unsupported methods**: `enabled`, `visible`, `unstyle`, `alias`, `theme`, `create` (warnings will be shown)

## Limitations

- **Runtime toggles** like `ac.enabled = false` require manual intervention
- **Custom themes and aliases** need to be rewritten as plain objects
- **Dynamic imports with `.then()`** are not transformed and require manual migration
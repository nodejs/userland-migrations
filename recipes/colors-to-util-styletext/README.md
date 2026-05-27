# Colors to util.styleText

This recipe migrates compatible `colors` package usage to Node.js built-in `util.styleText`.

## Examples

```diff
- const colors = require('colors');
+ const { styleText } = require('node:util');
- console.log('Error message'.red);
+ console.log(styleText('red', 'Error message'));
```

```diff
- import colors from 'colors';
+ import { styleText } from 'node:util';
- console.log('Success'.green.bold);
+ console.log(styleText(['green', 'bold'], 'Success'));
```

```diff
- const colors = require('colors/safe');
+ const { styleText } = require('node:util');
- console.log(colors.green('Success message'));
+ console.log(styleText('green', 'Success message'));
```

## Usage

Run this codemod with:

```sh
npx codemod nodejs/colors-to-util-styletext
```

## Compatibility

- Removes the `colors` dependency from package.json automatically.
- Supports string prototype colors and modifiers, including chained styles.
- Supports `colors/safe` namespace calls.
- Unsupported extras such as `rainbow`, `zebra`, `america`, `trap`, and `random` are left unchanged and reported for manual review.

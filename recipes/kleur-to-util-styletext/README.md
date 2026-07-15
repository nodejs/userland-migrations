# kleur to util.styleText

This recipe migrates from the external `kleur` package to Node.js built-in `util.styleText` API. It transforms kleur method calls to use the native Node.js styling functionality.

## Examples

```diff
- import kleur from 'kleur';
+ import { styleText } from 'node:util';
- console.log(kleur.red('Error message'));
+ console.log(styleText('red', 'Error message'));
- console.log(kleur.green('Success message'));
+ console.log(styleText('green', 'Success message'));
- console.log(kleur.blue('Info message'));
+ console.log(styleText('blue', 'Info message'));
```

```diff
- import kleur from 'kleur';
+ import { styleText } from 'node:util';
- console.log(kleur.red.bold('Important error'));
+ console.log(styleText(['red', 'bold'], 'Important error'));
- console.log(kleur.green.underline('Success with emphasis'));
+ console.log(styleText(['green', 'underline'], 'Success with emphasis'));
```

```diff
- const kleur = require('kleur');
+ const { styleText } = require('node:util');
- const red = kleur.red;
+ const red = (text) => styleText('red', text);
- const boldBlue = kleur.blue.bold;
+ const boldBlue = (text) => styleText(['blue', 'bold'], text);
- console.log(red('Error'));
+ console.log(red('Error'));
- console.log(boldBlue('Info'));
+ console.log(boldBlue('Info'));
```

## Usage

Run this codemod with:

```sh
npx codemod nodejs/kleur-to-util-styletext
```

## Compatibility

- **Removes kleur dependency** from package.json automatically
- **Supports kleur's full API**: every modifier, color, and background color kleur ships has a direct `util.styleText` equivalent, so no kleur method is left unsupported.

## Limitations

- **Complex conditional expressions** in some contexts may need manual review
- kleur exposes a secondary `kleur/colors` entry point (non-chainable individual color functions). This codemod targets the default `kleur` import/require only.
- **Direct calls chaining more than 4 styles** (e.g. `kleur.a.b.c.d.e("text")`) are left unchanged rather than transformed. Assigning the chain to a variable first (`const x = kleur.a.b.c.d.e; x("text")`) is transformed regardless of depth.

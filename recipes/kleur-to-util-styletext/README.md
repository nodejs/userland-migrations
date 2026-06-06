# Kleur to util.styleText

This recipe migrates from the external `kleur` package to Node.js built-in `util.styleText` API. It transforms `kleur` style calls and `kleur/colors` named style functions to the native Node.js styling functionality.

## Examples

```diff
- import kleur from 'kleur';
+ import { styleText } from 'node:util';
- console.log(kleur.red('Error'));
+ console.log(styleText('red', 'Error'));
- console.log(kleur.bold().red('Failure'));
+ console.log(styleText(['bold', 'red'], 'Failure'));
```

```diff
- import { green, dim } from 'kleur/colors';
+ import { styleText } from 'node:util';
- console.log(green('OK') + ' ' + dim(name));
+ console.log(styleText('green', 'OK') + ' ' + styleText('dim', name));
```

```diff
- import { bgRed, white } from 'kleur/colors';
+ import { styleText } from 'node:util';
- console.log(bgRed(white('FAIL')));
+ console.log(styleText(['bgRed', 'white'], 'FAIL'));
```

## Compatibility

- Removes the `kleur` dependency from package.json automatically
- Supports default, namespace, and CommonJS `kleur` imports
- Supports named imports and destructured requires from `kleur/colors`
- Leaves unsupported APIs such as `kleur.enabled` and `$` from `kleur/colors` unchanged

## Limitations

- Manual migration is required for `kleur.enabled`, `$` from `kleur/colors`, and other APIs that are not direct style functions

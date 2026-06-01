---
authors: JakobJingleheimer
---
# Correct TypeScript Import Specifiers

Adds or corrects file extensions in TypeScript import and export specifiers. Handles cases where the extension is missing entirely, where `.js` is used in place of `.ts` (or `.cjs`/`.mjs` in place of `.cts`/`.mts`), and where a bare directory specifier should resolve to an `index` file. Also promotes bare re-exports to `export type` when the target module only contains types.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/correct-ts-specifiers
```

## Examples

```diff
 import { URL } from 'node:url';

 import { bar } from '@dep/bar';
 import { foo } from 'foo';

-import { Bird } from './Bird';
+import { Bird } from './Bird/index.ts';
 import { Cat } from './Cat.ts';
-import { Dog } from '…/Dog/index.mjs';
+import { Dog } from '…/Dog/index.mts';
 import { baseUrl } from '#config.js';
-import { qux } from './qux.js';
+import { qux } from './qux.js/index.ts';

-export { Zed } from './zed';
+export type { Zed } from './zed.d.ts';

-const nil = await import('./nil.js');
+const nil = await import('./nil.ts');
```

## Notes

### Limitations

When both a `.js` file and a corresponding `.ts` file exist at the same path, the codemod cannot determine which one the specifier refers to. In that case it logs a warning, leaves the specifier unchanged, and continues processing the rest of the file.

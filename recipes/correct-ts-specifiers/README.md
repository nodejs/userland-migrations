---
authors: JakobJingleheimer
---

# Correct TypeScript Specifiers

Transforms import specifiers from the old `tsc` (TypeScript's compiler) requirement of using `.js` file extensions in source-code to import files that are actually TypeScript; the corrected specifiers enable source-code to be runnable by standards-compliant software like Node.js. This is a one-and-done process, and the updated source-code should be committed to your version control (eg git); thereafter, source-code import statements should be authored compliant with the ECMAScript (JavaScript) standard.

Supported cases:

- no file extension → `.cts`, `.mts`, `.js`, `.ts`, `.d.cts`, `.d.mts`, or `.d.ts`
- `.cjs` → `.cts`, `.mjs` → `.mts`, `.js` → `.ts`
- `.js` → `.d.cts`, `.d.mts`, or `.d.ts`
- [Package.json subpath imports](https://nodejs.org/api/packages.html#subpath-imports)
- [tsconfig paths](https://www.typescriptlang.org/tsconfig/#paths) (via [`@nodejs-loaders/alias`](https://github.com/JakobJingleheimer/nodejs-loaders/blob/main/packages/alias?tab=readme-ov-file))
  - In order to subsequently run code via node, you will need to add this (or another) loader to your own project. Or, switch to [subimports](https://nodejs.org/api/packages.html#subpath-imports).
- Commonjs-like directory specifiers

## Usage

> [!CAUTION]
> This will change your source-code. Commit any unsaved changes before running this package.

> [!IMPORTANT]
> [`--experimental-import-meta-resolve`](https://nodejs.org/api/cli.html#--experimental-import-meta-resolve) MUST be enabled; the feature is not really experimental—it's nonstandard because it's not relevant for browsers.

Run this codemod with:

```sh
NODE_OPTIONS="--experimental-import-meta-resolve" \
  npx codemod @nodejs/correct-ts-specifiers
```

### Monorepos

For best results, run this _within_ each workspace of the monorepo.

```text
project-root/
  ├ workspaces/
    ├ foo/ ←--------- RUN HERE
      ├ …
      ├ package.json
      └ tsconfig.json
    └ bar/ ←--------- RUN HERE
      ├ …
      ├ package.json
      └ tsconfig.json
  └ utils/ ←--------- RUN HERE
    ├ qux.js
    └ zed.js
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

> [!TIP]
> Those using `tsc` to compile will need to enable [`rewriteRelativeImportExtensions`](https://www.typescriptlang.org/tsconfig/#rewriteRelativeImportExtensions); using `tsc` for only type-checking (ex via a lint/test step like `npm run test:types`) needs [`allowImportingTsExtensions`](https://www.typescriptlang.org/tsconfig/#allowImportingTsExtensions) (and some additional compile options—see the cited documentation);

## Notes

This package does not just blindly find & replace file extensions within specifiers: It confirms that the replacement specifier actually exists; in ambiguous cases (such as two files with the same basename in the same location but different relevant file extensions like `/tmp/foo.js` and `/tmp/foo.ts`), it logs an error, skips that specifier, and continues processing.

> [!CAUTION]
> This package does not confirm that imported modules contain the desired export(s). This _shouldn't_ actually ever result in a problem because ambiguous cases are skipped (so if there is a problem, it existed before the migration started). Merely running your source-code after the migration completes will confirm all is well (if there are problems, node will error, citing the problems).

> [!TIP]
> Node.js requires the `type` keyword be present on type imports. For own code, this package usually handles that. However, in some cases and for node modules, it does not. Robust tooling already exists that will automatically fix this, such as
>
> - [`use-import-type` via biome](https://biomejs.dev/linter/rules/use-import-type/)
> - [`typescript/no-import-type-side-effects` via oxlint](https://oxc.rs/docs/guide/usage/linter/rules/typescript/no-import-type-side-effects)
> - [`consistent-type-imports` via typescript-lint](https://typescript-eslint.io/rules/consistent-type-imports)
>
> If your source code needs that, first run this codemod and then one of those fixers.

### Limitations

When both a `.js` file and a corresponding `.ts` file exist at the same path, the codemod cannot determine which one the specifier refers to. In that case it logs an error, leaves the specifier unchanged, and continues processing the rest of the file.

<!-- sync_to_learn: true -->

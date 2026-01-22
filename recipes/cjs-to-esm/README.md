
# ESM Migration Codemod

<!--
	TODO orrect reamde:
	- Remove "How it's will/should works" that's development notes
	- Improve "Limitations" section
	- Add Why/when to use this codemod
	- Add example usage
	- Add description of options
-->

## How it's will/should works

1. Change file extension from `.cjs` to `.js` & `.mjs` to `.js`. And IDK how keep track of this change.
2. Change importing files to use ESM syntax. With updating the specifier to reflect file extension changes.
3. Change exporting files to use ESM syntax.
4. Update context-local variables. If possible to track this change in goal of having the lowest nodejs version in the `engines` field of `package.json`.
5. Update `package.json`:
	- Add/update `"type": "module"` field.
	- Update file extensions in `"main"`, `"module"`, `"exports"`, and other relevant fields.
	- _not sure_ Remove `"exports"` field if it only contains CJS-specific entries.
	- update engines field to reflect the minimum Node.js version that supports all ESM features used in the codebase.

## Limitations

- Typescript: its will be more complex because we need to update the whole building process.

## REFS

- https://nodejs.github.io/package-examples/05-cjs-esm-migration/
- https://nodejs.github.io/package-examples/05-cjs-esm-migration/migrating-imports/
- https://nodejs.github.io/package-examples/05-cjs-esm-migration/migrating-exports/
- https://nodejs.github.io/package-examples/05-cjs-esm-migration/migrating-context-local-variables/
- https://nodejs.github.io/package-examples/05-cjs-esm-migration/migrating-package-json/

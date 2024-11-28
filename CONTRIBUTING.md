# Contributing

A recipe generally has a few things:

* A `README.md` explaining its purpose and use (including any options, and required and optional
files).
* Tests via node's test runner (min coverage: 80%)
  * unit tests  (file extension: `.spec.mjs` or `.spec.mts`)
  * end-to-end test(s) for accepted use-cases (file extension: `.e2e.mjs` or `.e2e.mts`)
* Code comments (js docs, etc)
* Types (either via typescript or jsdoc)

CI will run lint & type checking and all included test files against all PRs.

> [!NOTE]
> snapshots will be generated with the file extension `.snap.cjs`.

New recipes are added under `./recipes` in their own folder, succinctly named for what it does. General-purpose recipes have simple names like `correct-ts-specifiers`. A suite of migrations has a name like `migrate from 18 to 20`, and more specific migrations are named like `migrate fs.readFile from 18 to 20`.

## Before pushing a commit

A convenient superset of checks is available via `node --run pre-commit`, which automatically fixes formatting and linting issues, checks types, and runs unit and end-to-end tests. Changes resulting from this should be committed.

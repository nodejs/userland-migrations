# Contributing

A recipe generally has a few things:

* A `README.md` explaining its purpose and use (including any options, and required and optional
files).
* Tests via node's test runner (min coverage: 80%)
  * unit tests
  * end-to-end test(s) for accepted use-cases
  * a `test` command in `package.json`; there may be sub-commands like `test:unit` & `test:e2e`, but there must be a parent that combines them.
    * Include `--import='@nodejs/codemod-utils/snapshots` to standardise the filename (`${original_base_name}.snap.cjs`) across recipes.
    * Ensure `--test-coverage-include` and `--test-coverage-exclude` are set correctly for the recipe's workspace. The root repo handles setting coverage rules like minimum line coverage.
* Code comments (js docs, etc)
* Types (either via typescript or jsdoc)

CI will run lint & type checking and all included test files against all PRs.

New recipes are added under `./recipes` in their own folder, succinctly named for what they do. General-purpose recipes have simple names like `correct-ts-specifiers`. A suite of migrations has a name like `migrate from 18 to 20`, and more specific migrations are named like `migrate-fs-readFile-from-18-to-20`.

## Before pushing a commit

A convenient superset of checks is available via `node --run pre-commit`, which automatically fixes formatting and linting issues (that are safe to fix), checks types, and runs tests. Changes resulting from this should be committed.

> [!WARNING]
> Some test modify fixture dude to running the recipe, so you must not commit those changes.

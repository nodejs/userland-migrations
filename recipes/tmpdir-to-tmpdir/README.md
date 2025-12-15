# `tmpDir` DEP0022

This recipe transforms `tmpDir` function calls to `tmpdir`.

See [DEP0022](https://nodejs.org/docs/latest/api/deprecations.html#dep0022-ostmpdir).

## Examples

```diff
- import { tmpDir } from 'node:os';
- const foo = tmpDir()
-
+ import { tmpdir } from 'node:os';
+ const foo = tmpdir()
+
`````
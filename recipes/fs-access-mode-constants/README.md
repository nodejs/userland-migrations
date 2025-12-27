# `fs.F_OK`, `fs.R_OK`, `fs.W_OK`, `fs.X_OK` DEP0176

Handle DEP0176 via transforming imports of `fs.F_OK`, `fs.R_OK`, `fs.W_OK`, `fs.X_OK` from the root `fs` module to `fs.constants`.

See [DEP0176](https://nodejs.org/api/deprecations.html#dep0176-fsf_ok-fsr_ok-fsw_ok-fsx_ok)

## Example

```diff
  const fs = require('node:fs');

- fs.access('/path/to/file', fs.F_OK, callback);
+ fs.access('/path/to/file', fs.constants.F_OK, callback);
- fs.access('/path/to/file', fs.R_OK | fs.W_OK, callback);
+ fs.access('/path/to/file', fs.constants.R_OK | fs.constants.W_OK, callback);
`````
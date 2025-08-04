# `fs.F_OK`, `fs.R_OK`, `fs.W_OK`, `fs.X_OK` DEP0176

Handle DEP0176 via transforming imports of `fs.F_OK`, `fs.R_OK`, `fs.W_OK`, `fs.X_OK` from the root `fs` module to `fs.constants`.

See [DEP0176](https://nodejs.org/api/deprecations.html#dep0176-fsf_ok-fsr_ok-fsw_ok-fsx_ok)

## Examples

### Case 1: Direct access with namespace import

**Before:**

```js
const fs = require('node:fs');

fs.access('/path/to/file', fs.F_OK, callback);
fs.access('/path/to/file', fs.R_OK | fs.W_OK, callback);
```

**After:**
```js
const fs = require('node:fs');

fs.access('/path/to/file', fs.constants.F_OK, callback);
fs.access('/path/to/file', fs.constants.R_OK | fs.constants.W_OK, callback);
```

### Case 2: ESM namespace import

**Before:**
```js
import * as fs from 'node:fs';

fs.access('/path/to/file', fs.F_OK, callback);
fs.access('/path/to/file', fs.X_OK, callback);
```

**After:**

```js
import * as fs from 'node:fs';

fs.access('/path/to/file', fs.constants.F_OK, callback);
fs.access('/path/to/file', fs.constants.X_OK, callback);
```

### Case 3: Destructured import

**Before:**

```js
const { access, F_OK, R_OK, W_OK } = require('node:fs');

access('/path/to/file', F_OK, callback);
access('/path/to/file', R_OK | W_OK, callback);
```

**After:**

```js
const { access, constants } = require('node:fs');

access('/path/to/file', constants.F_OK, callback);
access('/path/to/file', constants.R_OK | constants.W_OK, callback);
```

### Case 4: named imports

**Before:**

```js
import { access, F_OK, R_OK, W_OK, X_OK } from 'node:fs';

access('/path/to/file', F_OK, callback);
access('/path/to/file', R_OK | W_OK | X_OK, callback);
```

**After:**

```js
import { access, constants } from 'node:fs';

access('/path/to/file', constants.F_OK, callback);
access('/path/to/file', constants.R_OK | constants.W_OK | constants.X_OK, callback);
```

### Case 5: Mixed usage patterns

**Before:**

```js
const { accessSync, F_OK, R_OK } = require('node:fs');
const fs = require('node:fs');

accessSync('/path/to/file', F_OK);
fs.access('/path/to/file', fs.W_OK | R_OK, callback);
```

**After:**

```js
const { accessSync, constants } = require('node:fs');
const fs = require('node:fs');

accessSync('/path/to/file', constants.F_OK);
fs.access('/path/to/file', fs.constants.W_OK | constants.R_OK, callback);
```

### Case 6: Using fs.promises.constants alternative

**Before:**

```js
import { promises as fsPromises, F_OK, R_OK } from 'node:fs';

await fsPromises.access('/path/to/file', F_OK);
```

**After:**

```js
import { promises as fsPromises } from 'node:fs';

await fsPromises.access('/path/to/file', fsPromises.constants.F_OK);
```

### Case 7: Complex expressions

**Before:**

```js
const fs = require('node:fs');

const mode = fs.R_OK | fs.W_OK;
if (condition) {
  fs.accessSync('/path/to/file', fs.F_OK);
}
```

**After:**

```js
const fs = require('node:fs');

const mode = fs.constants.R_OK | fs.constants.W_OK;
if (condition) {
  fs.accessSync('/path/to/file', fs.constants.F_OK);
}
```

### Case 8: Variable assignments

**Before:**

```js
import { F_OK, R_OK, W_OK, X_OK } from 'node:fs';

const readable = R_OK;
const writable = W_OK;
const executable = X_OK;
const exists = F_OK;
```

**After:**

```js
import { constants } from 'node:fs';

const readable = constants.R_OK;
const writable = constants.W_OK;
const executable = constants.X_OK;
const exists = constants.F_OK;
```
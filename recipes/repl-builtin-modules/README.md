# `repl.builtinModules` DEP0191

This recipe provides a guide for migrating from the deprecated `repl.builtinModules` to the new `module.builtinModules` property in Node.js.

See [DEP0191](https://nodejs.org/api/deprecations.html#DEP0191).

## Examples

**Before:**
```js
// Using require with namespace import
const repl = require('node:repl');
console.log(repl.builtinModules);

// Using require with destructuring
const { builtinModules } = require('node:repl');

// Using require with mixed destructuring
const { builtinModules, foo } = require('node:repl');

// Using ES6 import with named import
import { builtinModules } from 'node:repl';

// Using ES6 import with mixed named imports
import { builtinModules, foo } from 'node:repl';

// Using ES6 import with default import
import repl from 'node:repl';
console.log(repl.builtinModules);

// Using ES6 import with namespace import
import * as repl from 'node:repl';
console.log(repl.builtinModules);
```

**After:**
```js
// Using require with namespace import
const module = require('node:module');
console.log(module.builtinModules);

// Using require with destructuring
const { builtinModules } = require('node:module');

// Using require with mixed destructuring
const { foo } = require('node:repl');
const { builtinModules } = require('node:module');

// Using ES6 import with named import
import { builtinModules } from 'node:module';

// Using ES6 import with mixed named imports
import { foo } from 'node:repl';
import { builtinModules } from 'node:module';

// Using ES6 import with default import
import module from 'node:module';
console.log(module.builtinModules);

// Using ES6 import with namespace import
import * as module from 'node:module';
console.log(module.builtinModules);
```

# Node.js Timers Deprecations

This recipe migrates deprecated internals from `node:timers` to the supported public timers API. It replaces usages of `timers.enroll()`, `timers.unenroll()`, `timers.active()`, and `timers._unrefActive()` with standard constructs built on top of `setTimeout()`, `clearTimeout()`, and `Timer#unref()`.

See the upstream notices: [DEP0095](https://nodejs.org/api/deprecations.html#DEP0095), [DEP0096](https://nodejs.org/api/deprecations.html#DEP0096), [DEP0126](https://nodejs.org/api/deprecations.html#DEP0126), and [DEP0127](https://nodejs.org/api/deprecations.html#DEP0127).

## Example

### Replace `timers.enroll()`

```diff
- const timers = require('node:timers');
- const resource = { _idleTimeout: 1500 };
- timers.enroll(resource, 1500);
+ const resource = { timeout: setTimeout(() => {
+   // timeout handler
+ }, 1500) };
```

### Replace `timers.unenroll()`

```diff
- timers.unenroll(resource);
+ clearTimeout(resource.timeout);
```

### Replace `timers.active()` and `timers._unrefActive()`

```diff
- const timers = require('node:timers');
- timers.active(resource);
- timers._unrefActive(resource);
+ const handle = setTimeout(onTimeout, delay);
+ handle.unref();
```

## Caveats

The legacy APIs exposed internal timer bookkeeping fields such as `_idleStart` or `_idleTimeout`. Those internals have no public equivalent. The codemod focuses on migrating the control flow to modern timers and leaves application specific bookkeeping to the developer. Carefully review the transformed code to ensure that any custom metadata is still updated as expected.

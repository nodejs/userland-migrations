---
authors: AugustinMauroy
---
# DEP0095/DEP0096/DEP0126/DEP0127: Deprecated node:timers APIs

Migrates the four deprecated `node:timers` internal APIs — `timers.enroll()`, `timers.unenroll()`, `timers.active()`, and `timers._unrefActive()` — to their modern equivalents built on `setTimeout` and `clearTimeout`.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/timers-deprecations
```

## Examples

### Example 1

`timers.enroll(resource, delay)` — replaced with an inline `setTimeout` that calls `resource._onTimeout` and stores the handle on `resource.timeout`:

```diff
const timers = require("node:timers");

const resource = {
  _onTimeout() {
    console.log("done");
  },
};

-timers.enroll(resource, 1000);
+resource._idleTimeout = 1000;
+resource.timeout = setTimeout(() => {
+  if (typeof resource._onTimeout === "function") {
+    resource._onTimeout();
+  }
+}, 1000);
```

### Example 2

`timers.unenroll(resource)` — replaced with a `clearTimeout` followed by deleting the handle:

```diff
const timers = require("node:timers");

const resource = {
  timeout: setTimeout(() => { }, 1000),
};

-timers.unenroll(resource);
+clearTimeout(resource.timeout);
+delete resource.timeout;
```

### Example 3

`timers.active(resource)` — replaced with a conditional `clearTimeout` and a fresh `setTimeout` that re-uses `resource._idleTimeout` and `resource._onTimeout`:

```diff
const timers = require("node:timers");

const resource = {
  _idleTimeout: 500,
  timeout: setTimeout(() => { }, 500),
  _onTimeout() {
    console.log("again");
  },
};

-timers.active(resource);
+if (resource.timeout != null) {
+  clearTimeout(resource.timeout);
+}
+
+resource.timeout = setTimeout(() => {
+  if (typeof resource._onTimeout === "function") {
+    resource._onTimeout();
+  }
+}, resource._idleTimeout);
```

### Example 4

`timers._unrefActive(resource)` — same expansion as `timers.active()` plus a call to `.unref()` on the new handle:

```diff
const timers = require("node:timers");

const resource = {
  _idleTimeout: 60,
  timeout: setTimeout(() => { }, 60),
  _onTimeout() {
    console.log("cleanup");
  },
};

-timers._unrefActive(resource);
+if (resource.timeout != null) {
+  clearTimeout(resource.timeout);
+}
+
+resource.timeout = setTimeout(() => {
+  if (typeof resource._onTimeout === "function") {
+    resource._onTimeout();
+  }
+}, resource._idleTimeout);
+resource.timeout.unref?.();
```

## Notes

`timers.active(resource)` and `timers._unrefActive(resource)` expand into a multi-statement block that reads `resource._idleTimeout` for the delay and `resource._onTimeout` for the callback. These are internal bookkeeping fields that the deprecated API relied on. If the resource object in your code uses different field names, review the output and adjust accordingly.

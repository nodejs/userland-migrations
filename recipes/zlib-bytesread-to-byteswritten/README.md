# `zlib.bytesRead` → `zlib.bytesWritten` DEP0108

This codemod replace zlib.bytesRead with zlib.bytesWritten for consistent stream property naming. It's useful to migrate code that uses the deprecated property which has been removed.

It replace zlib.bytesRead with zlib.bytesWritten in all zlib transform streams and it handle both CommonJS and ESM imports.

See [DEP0108](https://nodejs.org/api/deprecations.html#DEP0108).

---

## Example

**Case 1**

Before:

```js
const zlib = require("node:zlib");
const gzip = zlib.createGzip();
gzip.on("end", () => {
  console.log("Bytes processed:", gzip.bytesRead);
});
```

After:

```js
const zlib = require("node:zlib");
const gzip = zlib.createGzip();
gzip.on("end", () => {
  console.log("Bytes processed:", gzip.bytesWritten);
});
```

**Case 2**

Before:

```js
const zlib = require("node:zlib");
const deflate = zlib.createDeflate();
deflate.on("finish", () => {
  const stats = {
    input: deflate.bytesRead,
    output: deflate.bytesWritten
  };
});
```

After:

```js
const zlib = require("node:zlib");
const deflate = zlib.createDeflate();
deflate.on("finish", () => {
  const stats = {
    input: deflate.bytesWritten,
    output: deflate.bytesWritten
  };
});
```

**Case 3**

Before:

```js
const zlib = require("node:zlib");
function trackProgress(stream) {
  setInterval(() => {
    console.log(`Progress: ${stream.bytesRead} bytes`);
  }, 1000);
}
```

After:

```js
const zlib = require("node:zlib");
function trackProgress(stream) {
  setInterval(() => {
    console.log(`Progress: ${stream.bytesWritten} bytes`);
  }, 1000);
}
```

**Case 4**

Before:

```js
import { createGzip } from "node:zlib";
const gzip = createGzip();
const bytesProcessed = gzip.bytesRead;
```

After:

```js
import { createGzip } from "node:zlib";
const gzip = createGzip();
const bytesProcessed = gzip.bytesWritten;
```

**Case 5**

Before:

```js
const zlib = require("node:zlib");
const gzip = zlib.createGzip();
const processed = gzip.bytesRead;
```

After:

```js
const zlib = require("node:zlib");
const gzip = zlib.createGzip();
const processed = gzip.bytesWritten;
```

**Case 6**

Before:

```js
const { createGzip } = require("node:zlib");
const gzip = createGzip();
const bytes = gzip.bytesRead;
```

After:

```js
const { createGzip } = require("node:zlib");
const gzip = createGzip();
const bytes = gzip.bytesWritten;
```
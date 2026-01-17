# HTTP/2 Priority Signaling Removal - DEP0194

This recipe removes HTTP/2 priority-related options and methods since priority signaling has been deprecated.

See [DEP0194](https://nodejs.org/api/deprecations.html#DEP0194).


## What this codemod does

- Removes the `priority` property from `http2.connect()` call options
- Removes the `priority` property from `session.request()` call options
- Removes entire `stream.priority()` method call statements
- Removes the `priority` property from `client.settings()` call options
- Handles both CommonJS (`require()`) and ESM (`import`) imports

## Examples

**Before:**

```js
// CommonJS usage
const http2 = require("node:http2");
const session = http2.connect("https://example.com", {
	priority: { weight: 16, parent: 0, exclusive: false }
});
const stream = session.request({
	":path": "/api/data",
	priority: { weight: 32 }
});
stream.priority({ exclusive: true, parent: 0, weight: 128 });

// ESM usage
import http2 from "node:http2";
const client = http2.connect("https://example.com");
client.settings({ enablePush: false, priority: true });
```

**After:**

```js
// CommonJS usage
const http2 = require("node:http2");
const session = http2.connect("https://example.com");
const stream = session.request({
	":path": "/api/data"
});
// stream.priority() removed

// ESM usage
import http2 from "node:http2";
const client = http2.connect("https://example.com");
client.settings({ enablePush: false });
```

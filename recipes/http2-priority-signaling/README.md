---
authors: AugustinMauroy
---

# DEP0194: HTTP/2 Priority Signaling

HTTP/2 priority signaling is deprecated in Node.js and has no replacement, so priority-related options and calls should simply be removed. This codemod removes the `priority` property from the options passed to `http2.connect()`, `session.request()`, and `session.settings()`, and removes entire `stream.priority()` call statements. It resolves `http2` and `node:http2` bindings across CommonJS `require()` and ESM `import` — default, namespace, named, and aliased `connect` imports — as well as dynamic `import()`. See [DEP0194](https://nodejs.org/api/deprecations.html#DEP0194).

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/http2-priority-signaling
```

## Examples

### `priority` option in `http2.connect()`

When `priority` is the only option, the whole options argument is removed.

```diff
 const http2 = require("node:http2");
-const session = http2.connect("https://example.com", {
-    priority: {
-        weight: 16,
-        parent: 0,
-        exclusive: false
-    }
-});
+const session = http2.connect("https://example.com");
```

### `priority` option in `session.request()`

Only the `priority` property is removed; other options are preserved.

```diff
 const stream = session.request({
-    ":path": "/api/data",
-    priority: { weight: 32 }
+    ":path": "/api/data"
 });
```

### `stream.priority()` calls

The entire method-call statement is removed.

```diff
 const stream = session.request({ ":path": "/" });
-stream.priority({
-    exclusive: true,
-    parent: 0,
-    weight: 128
-});
```

### `priority` option in `session.settings()`

The `priority` setting is dropped while the rest of the settings object is kept.

```diff
 import http2 from "node:http2";
 const client = http2.connect("https://example.com");
-client.settings({ enablePush: false, priority: true });
+client.settings({ enablePush: false });
```

## Notes

- Removal is scoped to sessions and streams the codemod can trace back to an `http2.connect()` binding, including chained `connect().request()` and `connect().settings()` calls, so unrelated objects that happen to contain a `priority` key are left untouched.
- `stream.priority()` statements are only removed for streams created from `session.request()` or a `connect().request()` chain.

<!-- sync_to_learn: false -->

---
authors: FrustratedBoy420
---

# DEP0207: `'aborted'` event and `.aborted` property in `node:http2`

Node.js deprecates the `'aborted'` event and the `.aborted` property of `Http2Stream` ([DEP0207](https://nodejs.org/api/deprecations.html#DEP0207)). The documented migration listens for `'close'` and checks `writableFinished`.

`'close'` with `!writableFinished` is not an exact replacement for `'aborted'`: the handler runs at a different time, and in some cases one fires and the other does not. So this codemod applies **one chosen strategy**: _run this handler when the writable side did not finish before the stream closed_. Run it only if that is what your `'aborted'` handlers mean, and review the diff.

> [!IMPORTANT]
> Run this codemod when you move to Node.js 27 or later. The deprecation comes with the HTTP/2 reset changes in [nodejs/node#63249](https://github.com/nodejs/node/pull/63249). On earlier versions the new handler can miss a peer reset: on Node.js 25, `'aborted'` fires when the peer resets a stream mid-response, but the writable side is already finished by `'close'`, so `!stream.writableFinished` is false.

## Usage

```sh
npx codemod @nodejs/http2-aborted-to-close
```

## What it changes

An inline `'aborted'` listener with no parameters on a stream it can resolve becomes a `'close'` listener whose body only runs when `writableFinished` is false. It works with `on`, `once`, `addListener`, `prependListener` and `prependOnceListener`.

The generated listener returns early when the writable side has finished. This keeps the original body and multiline strings intact, preserves returned promises, and allows nested listeners to migrate in the same pass. Explicit return types include `undefined` where needed for the early return.

Streams it resolves, from `http2` or `node:http2` through `require()` or `import` (default, namespace, named and aliased):

- the first parameter of a `'stream'` listener on a server from `createServer()` or `createSecureServer()`;
- a variable holding `session.request(...)`, where `session` comes from `connect()`.

Bindings are resolved within the file, so unrelated variables with the same name are left unchanged.

### Server stream

```diff
 const http2 = require('node:http2');

 const server = http2.createServer();
 server.on('stream', (stream) => {
-  stream.on('aborted', () => {
+  stream.on('close', () => {
+    if (stream.writableFinished) return;
     recordIncompleteResponse();
   });
 });
```

### Client request

```diff
 const client = http2.connect('https://example.com');
 const req = client.request({ ':path': '/' });
-req.on('aborted', () => cleanup(req));
+req.on('close', () => {
+  if (req.writableFinished) return;
+  return cleanup(req);
+});
```

## What it leaves for you

These cases are left unchanged and reported with a warning that gives the file, line and column:

- `.aborted` property reads such as `if (stream.aborted)`. Replace them with `destroyed`, `writableFinished` or `readableEnded`, whichever matches what the code means.
- Listeners passed by name (`stream.on('aborted', onAborted)`) or with parameters.
- Listeners that shadow the stream name in their own scope, or have a type predicate or an async return type other than an explicit `Promise<T>` that needs manual review.
- Every `'aborted'` listener of a stream whose `'aborted'` listeners are also removed, counted or listed (`off`, `removeListener`, `removeAllListeners`, `listeners`, `rawListeners`, `listenerCount`).

It does not touch:

- The compatibility API (`createServer((req, res) => ...)`). Request and response are different sides of the exchange, so pick `req` or `res` by hand.
- Read-side abort handling. That uses `'error'` with codes such as `ERR_HTTP2_STREAM_ABORTED`, and adding an `'error'` listener changes how exceptions are handled.

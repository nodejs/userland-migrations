---
authors: elvessilvavieira
---
# DEP0066: OutgoingMessage._headers / _headerNames -> getHeaders() / getRawHeaderNames()

Replaces deprecated `response._headers` with `response.getHeaders()` and `response._headerNames` with `response.getRawHeaderNames()` on HTTP server response objects.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/http-outgoingmessage-headers
```

## Examples

### Example 1

Reading headers and header names:

```diff
 const http = require('http');

 function handler(req, res) {
   res.setHeader('content-type', 'application/json');
   res.setHeader('x-custom-header', '42');

   console.log({
-    headers: res._headers,
-    headerNames: res._headerNames,
-    customHeader: res._headers['x-custom-header'],
-    count: Object.keys(res._headers).length,
+    headers: res.getHeaders(),
+    headerNames: res.getRawHeaderNames(),
+    customHeader: res.getHeaders()['x-custom-header'],
+    count: Object.keys(res.getHeaders()).length,
   });

   res.end('Hello World');
 }

 const server = http.createServer(handler);
```

### Example 2

Checking header existence:

```diff
 const http = require('http');

 const server = http.createServer((req, res) => {
-  if ('x-custom-header' in res._headers) {
+  if ('x-custom-header' in res.getHeaders()) {
     console.log('exists');
   }

-  if (Object.prototype.hasOwnProperty.call(res._headers, 'x-custom-header')) {
+  if (Object.prototype.hasOwnProperty.call(res.getHeaders(), 'x-custom-header')) {
     console.log('exists');
   }

-  if (res._headers['x-custom-header'] !== undefined) {
+  if (res.getHeaders()['x-custom-header'] !== undefined) {
     console.log('exists');
   }
 });
```

### Example 3

Iterating over headers and header names:

```diff
 const http = require('http');

 const server = http.createServer((req, res) => {
-  for (const name in res._headers) {
-    console.log(res._headers[name]);
+  for (const name in res.getHeaders()) {
+    console.log(res.getHeaders()[name]);
   }

-  Array.from(res._headerNames).forEach((name) => {
+  Array.from(res.getRawHeaderNames()).forEach((name) => {
     console.log(name);
   });

-  for (const name in res._headerNames) {
-    console.log(res._headerNames[name]);
+  for (const name in res.getRawHeaderNames()) {
+    console.log(res.getRawHeaderNames()[name]);
   }
 });
```

### Example 4

The codemod also handles `res` objects accessed via `server.on()` listeners, including when the event name or listener function is stored in a variable:

```diff
 const server = http.createServer((req, res) => {
-  console.log({ createServer: res._headers });
+  console.log({ createServer: res.getHeaders() });
 });

 server.on('request', (req, res) => {
-  console.log({ serverOnRequest: res._headers });
+  console.log({ serverOnRequest: res.getHeaders() });
 });

 const event = 'request';
 const listener = (req, res) => {
-  console.log({ serverOnRequest: res._headers });
+  console.log({ serverOnRequest: res.getHeaders() });
 };

 server.on(event, listener);
```

## Notes

The codemod traces the response object through `http.createServer()` request handlers and `server.on()` listeners for the `request`, `checkContinue`, and `checkExpectation` events. It resolves variable references, so handler functions and event names stored in variables are handled correctly.

### Limitations

Only accesses to `_headers` and `_headerNames` on the known response parameter are transformed. Arbitrary objects that happen to have a `_headers` or `_headerNames` property are left untouched.

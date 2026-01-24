# `OutgoingMessage` private header fields

This recipe transforms the usage of deprecated private fields `_headers` and `_headerNames` on `OutgoingMessage.prototype` to their public equivalents.

## Examples

### Reading headers

```diff
  const http = require('http');

  function handler(req, res) {
    res.setHeader('content-type', 'application/json');
    res.setHeader('x-custom-header', '42');

    console.log({
-     headers: res._headers,
+     headers: res.getHeaders(),
-     headerNames: res._headerNames,
+     headerNames: res.getRawHeaderNames(),
-     customHeader: res._headers['x-custom-header'],
+     customHeader: res.getHeaders()['x-custom-header'],
-     count: Object.keys(res._headers).length,
+     count: Object.keys(res.getHeaders()).length,
    });

    res.end('Hello World');
  }

  const server = http.createServer(handler);

  server.listen(3000, () => {
    console.log('Server running on port 3000');
  });
```

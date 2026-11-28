const http2 = require('node:http2');
const client = http2.connect('https://example.com');
const req = client.request();
req.on('close', function () {
  'use strict';
  if (req.writableFinished) return;
  cleanup();
});

const http2 = require('node:http2');
const client = http2.connect('https://example.com');
const req = client.request();
req.on('aborted', () => {
  record(`first
second
  third`);
  record(String.raw`first
second`);
  record('first\
second');
});

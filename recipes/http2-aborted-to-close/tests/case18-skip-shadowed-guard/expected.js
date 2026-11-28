const http2 = require('node:http2');
const client = http2.connect('https://example.com');
const req = client.request();
req.on('aborted', () => {
  const req = other;
  cleanup(req);
});
req.on('aborted', function req() { cleanup(); });
req.on('aborted', () => {
  if (flag) { var req = other; }
  cleanup(req);
});
req.on('aborted', () => {
  const { req } = other;
  cleanup(req);
});

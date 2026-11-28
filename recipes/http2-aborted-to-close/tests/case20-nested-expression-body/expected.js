const http2 = require('node:http2');
const client = http2.connect('https://example.com');
const req = client.request();
req.on('close', () => {
  if (req.writableFinished) return;
  return (() => {
  const next = client.request();
  next.on('close', () => { if (next.writableFinished) return; cleanup(); });
})();
});

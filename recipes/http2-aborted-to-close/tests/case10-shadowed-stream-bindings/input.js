const http2 = require('node:http2');
const client = http2.connect('https://example.com');
const req = client.request();
req.on('aborted', () => { cleanup(); });
function attach(req) {
  req.on('aborted', () => cleanup());
  req.removeAllListeners('aborted');
}
function destructured({ req }) {
  req.on('aborted', () => cleanup());
}
{
  const req = otherStream;
  req.on('aborted', () => cleanup());
}
try { work(); } catch (req) {
  req.on('aborted', () => cleanup());
}
for (const req of streams) {
  req.on('aborted', () => cleanup());
}
function captured() {
  req.once('aborted', () => { cleanup(); });
}

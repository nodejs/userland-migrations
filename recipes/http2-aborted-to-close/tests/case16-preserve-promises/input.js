const http2 = require('node:http2');
const client = http2.connect('https://example.com');
const req = client.request();
req.on('aborted', () => cleanup());
req.once('aborted', async () => cleanup());

import { createServer as createServer } from 'node:http2';
const http2 = require('node:http2');
const client = http2 . connect('https://example.com');
const req = client.request();
req.on('aborted', () => { cleanup(); });
createServer().on('stream', (stream) => {
  stream.on('aborted', () => { cleanup(); });
});
http2 . createServer().on('stream', (stream) => {
  stream.on('aborted', () => { cleanup(); });
});

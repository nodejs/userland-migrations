const http2 = require('node:http2');
const server = http2.createServer();
const client = http2.connect('https://example.com');
server.on('stream', (stream) => {
  stream.on('close', () => {
    if (stream.writableFinished) return;
    function retry() {
      const stream = client.request();
      stream.on('close', () => { if (stream.writableFinished) return; cleanup(); });
    }
    retry();
  });
});

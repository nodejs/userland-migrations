const http2 = require('node:http2');
const server = http2.createServer();
const client = http2.connect('https://example.com');
server.on('stream', (stream) => {
  stream.on('aborted', () => {
    function retry() {
      const stream = client.request();
      stream.on('aborted', () => { cleanup(); });
    }
    retry();
  });
});

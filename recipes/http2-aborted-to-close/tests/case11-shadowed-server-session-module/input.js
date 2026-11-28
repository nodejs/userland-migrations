const http2 = require('node:http2');
function start() {
  const server = http2.createServer();
  const client = http2.connect('https://example.com');
}
function unrelatedServer(server) {
  server.on('stream', (stream) => {
    stream.on('aborted', () => cleanup());
  });
}
function unrelatedSession(client) {
  const req = client.request();
  req.on('aborted', () => cleanup());
}
function unrelatedModule(http2) {
  const server = http2.createServer();
  server.on('stream', (stream) => {
    stream.on('aborted', () => cleanup());
  });
  const client = http2.connect('https://example.com');
  const req = client.request();
  req.on('aborted', () => cleanup());
}

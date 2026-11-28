import { createServer as makeServer, connect as open } from 'node:http2';
const server = makeServer();
server.on('stream', (stream) => {
  stream.on('aborted', () => { cleanup(); });
  function other(stream) {
    stream.on('aborted', () => cleanup());
    stream.removeAllListeners('aborted');
  }
});
function unrelatedFactory(makeServer, open) {
  makeServer().on('stream', (stream) => {
    stream.on('aborted', () => cleanup());
  });
  const client = open('https://example.com');
  const req = client.request();
  req.on('aborted', () => cleanup());
}

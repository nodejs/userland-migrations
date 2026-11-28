const { createServer } = require('http2');

createServer().on('stream', (s) => {
  s.addListener('aborted', () => { onAbort(); });
}).listen(8443);

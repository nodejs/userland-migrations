const { createServer } = require('http2');

createServer().on('stream', (s) => {
  s.addListener('close', () => {
    if (!s.writableFinished) {
      onAbort();
    }
  });
}).listen(8443);

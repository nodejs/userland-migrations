const http2 = require('node:http2');
const client = http2.connect('https://example.com');
const req = client.request();
// café 💡
req.on('aborted', () => {
  record(`café
💡 second`);
});

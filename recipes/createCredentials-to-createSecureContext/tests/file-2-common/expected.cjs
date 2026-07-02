const tls = require('node:tls');

const credentials = tls.createSecureContext({
  key: fs.readFileSync('server-key.pem'),
  cert: fs.readFileSync('server-cert.pem')
});
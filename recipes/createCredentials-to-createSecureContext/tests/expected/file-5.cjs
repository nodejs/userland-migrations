const tls = require('node:tls');

const credentials = tls.createSecureContext({
  key: privateKey,
  cert: certificate
});
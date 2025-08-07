const { createSecureContext } = require('node:tls');

const credentials = createSecureContext({
  key: privateKey,
  cert: certificate,
  ca: [caCertificate]
});

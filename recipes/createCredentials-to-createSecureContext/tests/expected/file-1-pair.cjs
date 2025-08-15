const { createSecureContext: customCreateCredentials } = require('node:tls');

const credentials = customCreateCredentials({
  key: privateKey,
  cert: certificate,
  ca: [caCertificate]
});
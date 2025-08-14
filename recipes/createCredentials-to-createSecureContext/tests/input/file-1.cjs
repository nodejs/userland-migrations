const { createCredentials } = require('node:crypto');

const credentials = createCredentials({
  key: privateKey,
  cert: certificate,
  ca: [caCertificate]
});
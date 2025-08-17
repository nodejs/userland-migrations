const { createCredentials: customCreateCredentials } = require('node:crypto');

const credentials = customCreateCredentials({
  key: privateKey,
  cert: certificate,
  ca: [caCertificate]
});
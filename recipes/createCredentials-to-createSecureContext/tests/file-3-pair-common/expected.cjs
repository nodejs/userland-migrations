const { createHash } = require('node:crypto');
const { createSecureContext: customCreateCredentials } = require('node:tls');

const credentials = customCreateCredentials({
  key: privateKey,
  cert: certificate
});

const hash = createHash('sha256');
hash.update('some data');
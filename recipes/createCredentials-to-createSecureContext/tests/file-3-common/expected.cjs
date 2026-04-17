const { createHash } = require('node:crypto');
const { createSecureContext } = require('node:tls');

const credentials = createSecureContext({
  key: privateKey,
  cert: certificate
});

const hash = createHash('sha256');
hash.update('some data');
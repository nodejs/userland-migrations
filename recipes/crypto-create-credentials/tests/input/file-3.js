const { createCredentials, createHash } = require('node:crypto');

const credentials = createCredentials({
  key: privateKey,
  cert: certificate
});

const hash = createHash('sha256');
hash.update('some data');

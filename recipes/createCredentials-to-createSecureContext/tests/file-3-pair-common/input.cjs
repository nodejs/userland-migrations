const { createCredentials : customCreateCredentials, createHash } = require('node:crypto');

const credentials = customCreateCredentials({
  key: privateKey,
  cert: certificate
});

const hash = createHash('sha256');
hash.update('some data');
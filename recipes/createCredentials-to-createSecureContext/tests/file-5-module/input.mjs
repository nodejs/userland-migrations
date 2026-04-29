import * as crypto from 'node:crypto';

const credentials = crypto.createCredentials({
  key: privateKey,
  cert: certificate
});
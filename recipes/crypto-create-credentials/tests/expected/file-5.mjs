import * as tls from 'node:tls';

const credentials = tls.createSecureContext({
  key: privateKey,
  cert: certificate
});

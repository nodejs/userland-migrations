import { createHash } from 'node:crypto';
import { createSecureContext as customCreateCredentials } from 'node:tls';

const credentials = customCreateCredentials({
  key: privateKey,
  cert: certificate
});

const hash = createHash('sha256');
hash.update('some data');
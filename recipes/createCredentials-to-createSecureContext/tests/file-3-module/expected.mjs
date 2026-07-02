import { createHash } from 'node:crypto';
import { createSecureContext } from 'node:tls';

const credentials = createSecureContext({
  key: privateKey,
  cert: certificate
});

const hash = createHash('sha256');
hash.update('some data');
import { createSecureContext } from 'node:tls';

const credentials = createSecureContext({
  key: privateKey,
  cert: certificate,
  ca: [caCertificate]
});

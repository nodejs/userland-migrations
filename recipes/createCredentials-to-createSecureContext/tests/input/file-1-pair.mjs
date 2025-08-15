import { createCredentials as customCreateCredentials } from 'node:crypto';

const credentials = customCreateCredentials({
  key: privateKey,
  cert: certificate,
  ca: [caCertificate]
});
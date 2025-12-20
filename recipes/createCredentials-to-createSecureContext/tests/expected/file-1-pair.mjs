import { createSecureContext as customCreateCredentials } from 'node:tls';

const credentials = customCreateCredentials({
  key: privateKey,
  cert: certificate,
  ca: [caCertificate]
});
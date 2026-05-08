const { createSecureContext } = await import('node:tls');

const credentials = createSecureContext({
  key: privateKey,
  cert: certificate
});
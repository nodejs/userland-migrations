const { createSecureContext: customCreateCredentials } = await import('node:tls');

const credentials = customCreateCredentials({
  key: privateKey,
  cert: certificate
});
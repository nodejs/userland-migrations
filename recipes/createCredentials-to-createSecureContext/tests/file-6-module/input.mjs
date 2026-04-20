const { createCredentials } = await import('node:crypto');

const credentials = createCredentials({
  key: privateKey,
  cert: certificate
});
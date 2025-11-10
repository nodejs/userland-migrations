const { createCredentials: customCreateCredentials } = await import('node:crypto');

const credentials = customCreateCredentials({
  key: privateKey,
  cert: certificate
});
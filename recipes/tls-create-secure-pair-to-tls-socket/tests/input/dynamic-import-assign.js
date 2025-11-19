const tls = await import('node:tls');
const pair = tls.createSecurePair(credentials);

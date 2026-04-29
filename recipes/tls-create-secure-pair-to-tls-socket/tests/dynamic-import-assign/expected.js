const tls = await import('node:tls');
const socket = new tls.TLSSocket(underlyingSocket, { secureContext: credentials });

import tls, { createServer } from 'node:tls';

const server = createServer(options);
const socket = new tls.TLSSocket(underlyingSocket, { secureContext: credentials });

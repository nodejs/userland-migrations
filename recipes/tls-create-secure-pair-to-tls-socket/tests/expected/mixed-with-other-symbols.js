const { createServer, TLSSocket } = require('node:tls');
const socket = new TLSSocket(underlyingSocket, { secureContext: credentials });
const server = createServer(options);

const { TLSSocket } = require('node:tls');

// Using an alias in CJS
const socket = new TLSSocket(underlyingSocket, { secureContext: credentials, isServer: true });

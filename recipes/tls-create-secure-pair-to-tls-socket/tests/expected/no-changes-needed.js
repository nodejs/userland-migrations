const { TLSSocket } = require('node:tls');

// Code that already uses TLSSocket - should not change
const socket = new TLSSocket(underlyingSocket, { secureContext: credentials });

const { TLSSocket } = require('node:tls');

// Multiple calls with different arguments
const pair1 = new TLSSocket(underlyingSocket, {});
const pair2 = new TLSSocket(underlyingSocket, { secureContext: credentials });
const pair3 = new TLSSocket(underlyingSocket, { secureContext: credentials, isServer: true });
const pair4 = new TLSSocket(underlyingSocket, { secureContext: credentials, isServer: true, requestCert: false });
const pair5 = new TLSSocket(underlyingSocket, { secureContext: credentials, isServer: true, requestCert: false, rejectUnauthorized: true });

const { TLSSocket } = require('node:tls');
const socket = new TLSSocket(underlyingSocket, { secureContext: credentials, isServer: true, requestCert: true, rejectUnauthorized: false });

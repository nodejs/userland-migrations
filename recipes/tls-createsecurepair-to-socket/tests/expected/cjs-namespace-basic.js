const tls = require('node:tls');
const socket = new tls.TLSSocket(underlyingSocket, { secureContext: credentials });

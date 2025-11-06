import * as tls from 'node:tls';
const socket = new tls.TLSSocket(underlyingSocket, { secureContext: credentials });

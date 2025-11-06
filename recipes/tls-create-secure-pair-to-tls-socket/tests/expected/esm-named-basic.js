import { TLSSocket } from 'node:tls';
const socket = new TLSSocket(underlyingSocket, { secureContext: credentials });

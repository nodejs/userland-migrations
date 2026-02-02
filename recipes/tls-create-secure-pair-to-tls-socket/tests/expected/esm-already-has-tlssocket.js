import { TLSSocket } from 'node:tls';

// Already has TLSSocket in imports
const socket = new TLSSocket(underlyingSocket, { secureContext: credentials });
const existingSocket = new TLSSocket(socket, {});

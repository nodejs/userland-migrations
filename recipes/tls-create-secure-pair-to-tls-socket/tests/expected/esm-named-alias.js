import { TLSSocket } from 'node:tls';

// Using an alias
const socket = new TLSSocket(underlyingSocket, { secureContext: credentials });

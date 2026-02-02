import { createSecurePair, TLSSocket } from 'node:tls';

// Already has TLSSocket in imports
const pair = createSecurePair(credentials);
const existingSocket = new TLSSocket(socket, {});

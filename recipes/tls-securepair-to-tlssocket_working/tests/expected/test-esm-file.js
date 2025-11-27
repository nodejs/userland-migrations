import tls from 'node:tls';
import { TLSSocket } from 'node:tls';

// Cas 1 : Via namespace
const socket1 = new tls.TLSSocket(socket);

// Cas 2 : Direct
const socket2 = new TLSSocket(socket);
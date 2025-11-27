import tls from 'node:tls';

// Using tls.SecurePair constructor
const socket = new tls.TLSSocket(socket);

// Direct import
import { TLSSocket } from 'node:tls';
const socket2 = new TLSSocket(socket);
import tls from 'node:tls';
import { TLSSocket } from 'node:tls';

// Case 1: Via namespace
const socket1 = new tls.TLSSocket(socket);

// Case 2: Direct
const socket2 = new TLSSocket(socket);
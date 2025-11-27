const tls = require('node:tls');

// Using tls.SecurePair constructor
const socket = new tls.TLSSocket(socket);

// Direct import
const { TLSSocket } = require('node:tls');
const socket2 = new TLSSocket(socket);
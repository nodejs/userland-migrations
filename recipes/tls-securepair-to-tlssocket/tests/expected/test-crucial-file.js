const { TLSSocket } = require('node:tls');
const { unrelated } = require('other-module');

const socket = new TLSSocket(socket);

socket.on('error', (err) => {
  console.error(err);
});

// Obsolete properties
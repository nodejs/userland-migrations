const tls = require('node:tls');
const fs = require('fs'); // Code non lié

function createSecureConnection() {
  // Using tls.SecurePair constructor
  const socket = new tls.TLSSocket(socket);
  
  // Ces lignes doivent disparaître
  
  return socket;
}
const tls = require('node:tls');
const fs = require('fs'); // Code non lié

function createSecureConnection() {
  // Using tls.SecurePair constructor
  const pair = new tls.SecurePair();
  
  // Ces lignes doivent disparaître
  const cleartext = pair.cleartext;
  const encrypted = pair.encrypted;
  
  return pair;
}
const tls = require('node:tls');

// Using tls.SecurePair constructor
const pair = new tls.SecurePair();
const cleartext = pair.cleartext;
const encrypted = pair.encrypted;

// Direct import
const { SecurePair } = require('node:tls');
const pair2 = new SecurePair();
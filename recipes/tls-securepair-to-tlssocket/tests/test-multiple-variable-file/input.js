const tls = require('node:tls');

const pair = new tls.SecurePair();
const myPair = new tls.SecurePair();
const securePairInstance = new tls.SecurePair();

// Specific cleanup for each variable
pair.cleartext.write('hello');
myPair.encrypted.write('world');
const { SecurePair } = require('node:tls');
const { unrelated } = require('other-module');

const pair = new SecurePair();

pair.on('error', (err) => {
  console.error(err);
});

// Propriétés obsolètes
console.log(pair.cleartext);
console.log(pair.encrypted);
const crypto = require('crypto');

// Nested object structure - codemod transforms ALL hash/mgf1Hash properties in object tree
crypto.generateKeyPair('rsa-pss', {
  modulusLength: 2048,
  options: {
    hash: 'sha256',
    mgf1Hash: 'sha1'
  },
  saltLength: 32
}, (err, publicKey, privateKey) => {
  console.log('Generated keys');
});

// Mixed nested and direct properties
crypto.generateKeyPairSync('rsa-pss', {
  modulusLength: 2048,
  hash: 'sha256',  // Direct property - should be transformed
  advanced: {
    mgf1Hash: 'sha1'  // Nested property - also gets transformed
  }
});
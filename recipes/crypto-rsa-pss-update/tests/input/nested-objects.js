const crypto = require('crypto');

// Nested object structure test
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
  hash: 'sha256',
  advanced: {
    mgf1Hash: 'sha1'
  }
});
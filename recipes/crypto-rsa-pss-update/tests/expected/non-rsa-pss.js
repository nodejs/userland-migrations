const crypto = require('crypto');

// Should NOT be transformed - different key type
crypto.generateKeyPair('rsa', {
  modulusLength: 2048,
  hash: 'sha256'
}, (err, publicKey, privateKey) => {
  // callback
});

// Should NOT be transformed - ed25519
crypto.generateKeyPairSync('ed25519', {
  hash: 'sha256'
});

// Should be transformed - rsa-pss
crypto.generateKeyPair('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: 'sha256'
});
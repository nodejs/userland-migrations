const crypto = require('crypto');

// Nested object structure test
crypto.generateKeyPair('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: 'sha256',
  saltLength: 32
}, (err, publicKey, privateKey) => {
  console.log('Generated keys');
});

// Mixed nested and direct properties
crypto.generateKeyPairSync('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: 'sha256',
  mgf1HashAlgorithm: 'sha1'
});
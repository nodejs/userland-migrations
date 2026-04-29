const crypto = require('crypto');

// Basic case with hash option only
crypto.generateKeyPair('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: 'sha256',
  saltLength: 32
}, (err, publicKey, privateKey) => {
  console.log('Generated keys');
});

// Both hash and mgf1Hash options together
crypto.generateKeyPairSync('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: 'sha256',
  mgf1HashAlgorithm: 'sha1'
});
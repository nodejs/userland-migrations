const crypto = require('crypto');

// Basic case with hash option
crypto.generateKeyPair('rsa-pss', {
  modulusLength: 2048,
  hash: 'sha256',
  saltLength: 32
}, (err, publicKey, privateKey) => {
  console.log('Generated keys');
});

// Basic case with mgf1Hash option
crypto.generateKeyPairSync('rsa-pss', {
  modulusLength: 2048,
  mgf1Hash: 'sha256'
});

// Both options together
crypto.generateKeyPair('rsa-pss', {
  modulusLength: 2048,
  hash: 'sha256',
  mgf1Hash: 'sha1',
  saltLength: 32
});
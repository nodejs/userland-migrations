const { generateKeyPair, generateKeyPairSync } = require('crypto');

// Destructured import with hash option
generateKeyPair('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: 'sha256'
}, (err, publicKey, privateKey) => {
  // callback
});

// Destructured sync version
generateKeyPairSync('rsa-pss', {
  modulusLength: 2048,
  mgf1HashAlgorithm: 'sha1'
});
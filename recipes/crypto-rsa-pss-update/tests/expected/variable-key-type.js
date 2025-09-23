const crypto = require('crypto');

const keyType = 'rsa-pss';
const algorithm = 'sha256';

// Variable type parameter - should be detected and transformed ideally
crypto.generateKeyPair(keyType, {
  modulusLength: 2048,
  hashAlgorithm: algorithm,
  saltLength: 32
}, (err, publicKey, privateKey) => {
  console.log('Generated keys with variable type');
});

// Another variable case
const rsaPssType = 'rsa-pss';
crypto.generateKeyPairSync(rsaPssType, {
  modulusLength: 2048,
  mgf1HashAlgorithm: 'sha1'
});
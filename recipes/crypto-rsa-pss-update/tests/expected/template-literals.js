const crypto = require('crypto');

const algorithm = 'sha256';
const mgfAlgorithm = 'sha1';

// Template literal test case
crypto.generateKeyPair('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: `${algorithm}`,
  saltLength: 32
}, (err, publicKey, privateKey) => {
  console.log('Generated keys');
});

// Complex template literal test case
crypto.generateKeyPairSync('rsa-pss', {
  modulusLength: 2048,
  mgf1HashAlgorithm: `${mgfAlgorithm}-mgf`
});
const { generateKeyPair: foo, generateKeyPairSync: bar } = require('node:crypto');

// This should be transformed but currently fails
foo('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: 'sha256',
  saltLength: 32
}, (err, publicKey, privateKey) => {
  console.log('Generated keys');
});

// This should also be transformed
bar('rsa-pss', {
  modulusLength: 2048,
  mgf1HashAlgorithm: 'sha256'
});
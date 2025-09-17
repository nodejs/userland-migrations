const crypto = require('crypto');

const baseOptions = {
  modulusLength: 2048,
  saltLength: 32
};

const hashOptions = {
  hash: 'sha256'
};

// Spread operator with hash option
crypto.generateKeyPair('rsa-pss', {
  ...baseOptions,
  hash: 'sha256',
  mgf1Hash: 'sha1'
}, (err, publicKey, privateKey) => {
  console.log('Generated keys');
});

// Spread with existing hash options
crypto.generateKeyPairSync('rsa-pss', {
  ...baseOptions,
  ...hashOptions,
  mgf1Hash: 'sha1'
});
import * as crypto from 'node:crypto';

// This should be transformed but currently fails
crypto.generateKeyPair('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: 'sha256',
  saltLength: 32
}, (err, publicKey, privateKey) => {
  console.log('Generated keys');
});

// This should also be transformed
crypto.generateKeyPairSync('rsa-pss', {
  modulusLength: 2048,
  mgf1HashAlgorithm: 'sha256'
});
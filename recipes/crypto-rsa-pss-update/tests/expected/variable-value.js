const crypto = require('crypto');

const algo = 'sha256';
const hashAlgo = 'sha1';

// Variable value case
crypto.generateKeyPairSync('rsa-pss', {
  modulusLength: 2048,
  mgf1HashAlgorithm: algo
});

// Multiple variable values
crypto.generateKeyPair('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: hashAlgo,
  mgf1HashAlgorithm: algo
});
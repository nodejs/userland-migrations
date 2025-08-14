const crypto = require('crypto');
const util = require('util');

// Case 1: Basic promisified wrapper
const generateKeyPairAsync = util.promisify(crypto.generateKeyPair);

generateKeyPairAsync('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: 'sha256',
  mgf1HashAlgorithm: 'sha1',
  saltLength: 32
});

// Case 2: Promisified sync version
const generateKeyPairSyncAsync = util.promisify(crypto.generateKeyPairSync);

generateKeyPairSyncAsync('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: 'sha512'
});

// Case 3: Different variable name
const keyGenAsync = util.promisify(crypto.generateKeyPair);

keyGenAsync('rsa-pss', {
  mgf1HashAlgorithm: 'sha256'
});

// Case 4: Destructured import with promisify
const { generateKeyPair } = require('crypto');
const generateKeyPairPromise = util.promisify(generateKeyPair);

generateKeyPairPromise('rsa-pss', {
  hashAlgorithm: 'sha1',
  mgf1HashAlgorithm: 'sha256'
});

// Case 5: Mixed with regular calls
crypto.generateKeyPair('rsa-pss', {
  hashAlgorithm: 'sha256'
});

// Case 6: Non-rsa-pss should not transform
generateKeyPairAsync('rsa', {
  hash: 'sha256'
});
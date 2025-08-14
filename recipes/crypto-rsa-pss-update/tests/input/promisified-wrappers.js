const crypto = require('crypto');
const util = require('util');

// Case 1: Basic promisified wrapper
const generateKeyPairAsync = util.promisify(crypto.generateKeyPair);

generateKeyPairAsync('rsa-pss', {
  modulusLength: 2048,
  hash: 'sha256',
  mgf1Hash: 'sha1',
  saltLength: 32
});

// Case 2: Promisified sync version
const generateKeyPairSyncAsync = util.promisify(crypto.generateKeyPairSync);

generateKeyPairSyncAsync('rsa-pss', {
  modulusLength: 2048,
  hash: 'sha512'
});

// Case 3: Different variable name
const keyGenAsync = util.promisify(crypto.generateKeyPair);

keyGenAsync('rsa-pss', {
  mgf1Hash: 'sha256'
});

// Case 4: Destructured import with promisify
const { generateKeyPair } = require('crypto');
const generateKeyPairPromise = util.promisify(generateKeyPair);

generateKeyPairPromise('rsa-pss', {
  hash: 'sha1',
  mgf1Hash: 'sha256'
});

// Case 5: Mixed with regular calls
crypto.generateKeyPair('rsa-pss', {
  hash: 'sha256'
});

// Case 6: Non-rsa-pss should not transform
generateKeyPairAsync('rsa', {
  hash: 'sha256'
});
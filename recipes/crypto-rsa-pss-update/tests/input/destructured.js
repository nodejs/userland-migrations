// Comprehensive import patterns test
import { generateKeyPair } from 'crypto';
const { generateKeyPairSync } = require('node:crypto');
const { generateKeyPair: aliasedGenerateKeyPair } = require('crypto');

// ES6 import destructuring
generateKeyPair('rsa-pss', {
  modulusLength: 2048,
  hash: 'sha256'
}, (err, publicKey, privateKey) => {
  console.log('ES6 import');
});

// CommonJS destructuring
generateKeyPairSync('rsa-pss', {
  modulusLength: 2048,
  mgf1Hash: 'sha1'
});

// Aliased destructuring
aliasedGenerateKeyPair('rsa-pss', {
  modulusLength: 2048,
  hash: 'sha512',
  mgf1Hash: 'sha256'
});
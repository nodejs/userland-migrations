// Comprehensive import patterns test
import { generateKeyPair } from 'crypto';
import crypto as nodeCrypto from 'crypto';
import { generateKeyPair as keyGen } from 'node:crypto';
const { generateKeyPairSync } = require('node:crypto');
const { generateKeyPair: aliasedGenerateKeyPair, generateKeyPairSync: foo } = require('crypto');
const cryptoLib = require('crypto');

// ES6 import destructuring
generateKeyPair('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: 'sha256'
}, (err, publicKey, privateKey) => {
  console.log('ES6 import');
});

// CommonJS destructuring
generateKeyPairSync('rsa-pss', {
  modulusLength: 2048,
  mgf1HashAlgorithm: 'sha1'
});

// Aliased destructuring with meaningful names
aliasedGenerateKeyPair('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: 'sha512',
  mgf1HashAlgorithm: 'sha256'
});

// Aliased destructuring with short names
foo('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: 'sha384'
});

// Namespace import with alias
nodeCrypto.generateKeyPair('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: 'sha256',
  saltLength: 32
}, (err, publicKey, privateKey) => {
  console.log('Generated keys with aliased import');
});

// Function alias from destructuring
keyGen('rsa-pss', {
  modulusLength: 2048,
  mgf1HashAlgorithm: 'sha1'
});

// Variable assignment
cryptoLib.generateKeyPairSync('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: 'sha512'
});

// Mixed CJS + ESM imports (consolidated from mixed-imports.js)
import { constants, randomBytes } from 'crypto';

// Using constants from ESM import
const optionsMixed = {
  hashAlgorithm: constants.defaultCipherName || 'sha256',
  mgf1HashAlgorithm: 'sha1',
  modulusLength: 2048
};

cryptoLib.generateKeyPair('rsa-pss', optionsMixed);
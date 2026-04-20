const crypto = require('crypto');

// Computed property names - ideally should be transformed
const hashKey = 'hashAlgorithm';
const mgfKey = 'mgf1HashAlgorithm';

// Case 1: Computed property with bracket notation
const options1 = {
  modulusLength: 2048,
  [hashKey]: 'sha256',        // Ideally should transform to hashAlgorithm
  mgf1HashAlgorithm: 'sha1'            // Should transform (static)
};

crypto.generateKeyPair('rsa-pss', options1, (err, publicKey, privateKey) => {
  console.log('Generated with computed hash property');
});

// Case 2: Both properties computed
const options2 = {
  [hashKey]: 'sha256',        // Ideally should transform
  [mgfKey]: 'sha1'            // Ideally should transform
};

crypto.generateKeyPairSync('rsa-pss', options2);

// Case 3: Mixed static and computed
const options3 = {
  hashAlgorithm: 'sha256',             // Should transform
  [mgfKey]: 'sha1',           // Ideally should transform
  modulusLength: 2048
};

crypto.generateKeyPair('rsa-pss', options3);

// Case 4: Dynamic key construction
const propertyName = 'hashAlgorithm';
const anotherProperty = 'mgf1HashAlgorithm';

const options4 = {
  [propertyName]: 'sha256',
  [anotherProperty]: 'sha1',
  modulusLength: 2048
};

crypto.generateKeyPairSync('rsa-pss', options4);
const crypto = require('crypto');

// Dynamic options object - now supported by codemod
const options = {
  modulusLength: 2048,
  hashAlgorithm: 'sha256',
  saltLength: 32
};

crypto.generateKeyPair('rsa-pss', options, (err, publicKey, privateKey) => {
  console.log('Generated keys with dynamic options');
});

// Function returning options
function getKeyOptions() {
  return {
    modulusLength: 2048,
    mgf1HashAlgorithm: 'sha1'
  };
}

crypto.generateKeyPairSync('rsa-pss', getKeyOptions());
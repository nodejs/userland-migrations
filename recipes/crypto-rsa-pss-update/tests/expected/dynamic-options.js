const crypto = require('crypto');

// Dynamic options object - currently NOT supported by codemod
const options = {
  modulusLength: 2048,
  hash: 'sha256',
  saltLength: 32
};

crypto.generateKeyPair('rsa-pss', options, (err, publicKey, privateKey) => {
  console.log('Generated keys with dynamic options');
});

// Function returning options
function getKeyOptions() {
  return {
    modulusLength: 2048,
    mgf1Hash: 'sha1'
  };
}

crypto.generateKeyPairSync('rsa-pss', getKeyOptions());
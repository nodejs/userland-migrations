const crypto = require('crypto');

const algorithm = 'sha256';
const mgfAlgorithm = 'sha1';

// Template literal values - NOTE: current codemod behavior extracts only the first identifier
crypto.generateKeyPair('rsa-pss', {
  modulusLength: 2048,
  hash: `${algorithm}`,
  saltLength: 32
}, (err, publicKey, privateKey) => {
  console.log('Generated keys');
});

// More complex template literals - NOTE: complex expressions get simplified
crypto.generateKeyPairSync('rsa-pss', {
  modulusLength: 2048,
  mgf1Hash: `${mgfAlgorithm}-mgf`
});
const crypto = require('crypto');
const { promisify } = require('util');

// Case 1: Promise chaining with crypto.generateKeyPair
crypto.generateKeyPair('rsa-pss', {
  modulusLength: 2048,
  hash: 'sha256',
  mgf1Hash: 'sha1'
}, (err, publicKey, privateKey) => {
  console.log('Generated keys');
});

// Case 2: Method chaining with promisified version
const generateKeyPairAsync = promisify(crypto.generateKeyPair);

generateKeyPairAsync('rsa-pss', {
  hash: 'sha256',
  mgf1Hash: 'sha1',
  modulusLength: 2048
}).then(({ publicKey, privateKey }) => {
  console.log('Keys generated via promise');
}).catch(console.error);

// Case 3: Async/await with inline options
async function generateKeys() {
  try {
    const { publicKey, privateKey } = await generateKeyPairAsync('rsa-pss', {
      hash: 'sha256',
      mgf1Hash: 'sha1'
    });
    return { publicKey, privateKey };
  } catch (error) {
    console.error('Key generation failed:', error);
  }
}

// Case 4: Class method with fluent API pattern
class KeyGenerator {
  constructor() {
    this.options = {};
  }

  setHash(algorithm) {
    this.options.hash = algorithm;
    return this;
  }

  setMgf1Hash(algorithm) {
    this.options.mgf1Hash = algorithm;
    return this;
  }

  async generate() {
    return generateKeyPairAsync('rsa-pss', this.options);
  }
}

// Usage
new KeyGenerator()
  .setHash('sha256')
  .setMgf1Hash('sha1')
  .generate()
  .then(console.log);
const crypto = require('crypto');

// Class with this.property patterns
class CryptoHelper {
  constructor() {
    this.options = {
      modulusLength: 2048,
      hashAlgorithm: 'sha256',
      mgf1HashAlgorithm: 'sha1',
      saltLength: 32
    };
    
    this.advancedOptions = {
      hashAlgorithm: 'sha512',
      algorithm: 'RSA-PSS'
    };
  }

  generateKey() {
    crypto.generateKeyPair('rsa-pss', this.options, (err, publicKey, privateKey) => {
      console.log('Generated with this.options');
    });
  }

  generateAdvancedKey() {
    return crypto.generateKeyPairSync('rsa-pss', this.advancedOptions);
  }
}

// Object method with this.property
const cryptoService = {
  cryptoConfig: {
    modulusLength: 2048,
    mgf1Hash: 'sha256'
  },
  
  init() {
    this.cryptoConfig = {
      modulusLength: 4096,
      hashAlgorithm: 'sha384',
      mgf1HashAlgorithm: 'sha512'
    };
  },
  
  generate() {
    crypto.generateKeyPair('rsa-pss', this.cryptoConfig, () => {});
  }
};

// Mixed case - some this.property, some not
function testMixed() {
  const localOptions = { hashAlgorithm: 'sha256' };
  
  this.globalOptions = {
    hashAlgorithm: 'sha512',
    mgf1HashAlgorithm: 'sha1'
  };
  
  crypto.generateKeyPair('rsa-pss', localOptions);
  crypto.generateKeyPairSync('rsa-pss', this.globalOptions);
}
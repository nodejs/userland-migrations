const crypto = require('crypto');

const isDev = process.env.NODE_ENV === 'development';
const useStrong = true;

// Case 1: Ternary operator in options object - currently no change (limitation)
const options1 = isDev ? 
  { hash: 'sha1', mgf1Hash: 'sha1' } :
  { hash: 'sha256', mgf1Hash: 'sha256' };

crypto.generateKeyPair('rsa-pss', options1, (err, publicKey, privateKey) => {
  console.log('Generated with conditional options');
});

// Case 2: Conditional within object properties - actually WORKS!
const options2 = {
  modulusLength: 2048,
  hash: useStrong ? 'sha256' : 'sha1',
  mgf1Hash: isDev ? 'sha1' : 'sha256'
};

crypto.generateKeyPairSync('rsa-pss', options2);

// Case 3: Logical AND/OR expressions - actually WORKS!
const options3 = {
  hash: (isDev && 'sha1') || 'sha256',
  mgf1Hash: useStrong && 'sha256'
};

crypto.generateKeyPair('rsa-pss', options3);

// Case 4: Function call in conditional - inline objects WORK!
function getHashOptions() {
  return { hash: 'sha256', mgf1Hash: 'sha1' };
}

crypto.generateKeyPairSync('rsa-pss', 
  isDev ? getHashOptions() : { hash: 'sha1' }
);
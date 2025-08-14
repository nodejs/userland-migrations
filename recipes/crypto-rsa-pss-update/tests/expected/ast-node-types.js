const crypto = require('crypto');

// Test case 1: member_expression - accessing constants
const constants = { 
  SECURE_HASH: 'sha512',
  MGF_HASH: 'sha256'
};

crypto.generateKeyPair('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: constants,  // ← member_expression
  saltLength: 32
});

// Test case 2: call_expression - functions returning algorithms
function getSecureHash() {
  return 'sha256';
}

function getMgfHash() {
  return 'sha1';
}

crypto.generateKeyPairSync('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: getSecureHash,     // ← call_expression
  mgf1HashAlgorithm: getMgfHash     // ← call_expression
});

// Test case 3: binary_expression - string concatenation
const bitLength = '256';
crypto.generateKeyPair('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: 'sha',   // ← binary_expression
  mgf1HashAlgorithm: 'sha'      // ← binary_expression
});

// Test case 4: conditional_expression - ternary operator
const isProduction = true;
const useStrongSecurity = false;

crypto.generateKeyPairSync('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: 'sha512',                    // ← conditional_expression
  mgf1HashAlgorithm: 'sha256'              // ← conditional_expression
});

// Test case 5: Complex mixed cases
crypto.generateKeyPair('rsa-pss', {
  modulusLength: 2048,
  hashAlgorithm: 'production',  // ← multiple types
  saltLength: 32
});
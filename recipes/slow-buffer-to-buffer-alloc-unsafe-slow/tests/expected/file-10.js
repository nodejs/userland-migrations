// Comments and whitespace edge cases
const { Buffer } = require('buffer');

// Using SlowBuffer constructor - should be updated
const buf1 = Buffer.allocUnsafeSlow(1024); // inline comment about SlowBuffer
/* 
 * Multi-line comment mentioning SlowBuffer
 * This should not be changed by the codemod
 */
const buf2 = Buffer.allocUnsafeSlow(512);

// Edge case: SlowBuffer in string (should not be changed)
const message = "This mentions SlowBuffer but should not change";
const code = 'new SlowBuffer(100)'; // This is in a string
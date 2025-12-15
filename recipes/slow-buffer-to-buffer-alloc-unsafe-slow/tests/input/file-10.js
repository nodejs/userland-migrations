// Comments and whitespace edge cases
const { SlowBuffer } = require('buffer');

// Using SlowBuffer constructor - should be updated
const buf1 = new SlowBuffer(1024); // inline comment about SlowBuffer
/* 
 * Multi-line comment mentioning SlowBuffer
 * This should not be changed by the codemod
 */
const buf2 = SlowBuffer(512);

// Edge case: SlowBuffer in string (should not be changed)
const message = "This mentions SlowBuffer but should not change";
const code = 'new SlowBuffer(100)'; // This is in a string
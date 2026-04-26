// No arguments edge case
const { Buffer } = require('buffer');

// SlowBuffer with no arguments (edge case)
const buf1 = Buffer.allocUnsafeSlow();
const buf2 = Buffer.allocUnsafeSlow();

// SlowBuffer with empty parentheses and whitespace
const buf3 = Buffer.allocUnsafeSlow( );
const buf4 = Buffer.allocUnsafeSlow(   );
// No arguments edge case
const { SlowBuffer } = require('buffer');

// SlowBuffer with no arguments (edge case)
const buf1 = new SlowBuffer();
const buf2 = SlowBuffer();

// SlowBuffer with empty parentheses and whitespace
const buf3 = new SlowBuffer( );
const buf4 = SlowBuffer(   );
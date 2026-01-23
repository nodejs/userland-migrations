// Edge case: Just SlowBuffer in destructuring
const { Buffer } = require('buffer');

// Edge case: SlowBuffer at different positions
const { Buffer, constants } = require('buffer');
const { constants, Buffer } = require('buffer');

// Edge case: Multiple SlowBuffer references (should only add Buffer once)
const buf1 = Buffer.allocUnsafeSlow(100);
const buf2 = Buffer.allocUnsafeSlow(200);
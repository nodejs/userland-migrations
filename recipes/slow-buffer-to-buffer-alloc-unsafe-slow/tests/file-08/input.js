// Edge case: Just SlowBuffer in destructuring
const { SlowBuffer } = require('buffer');

// Edge case: SlowBuffer at different positions
const { Buffer, SlowBuffer, constants } = require('buffer');
const { constants, SlowBuffer, Buffer } = require('buffer');

// Edge case: Multiple SlowBuffer references (should only add Buffer once)
const buf1 = new SlowBuffer(100);
const buf2 = SlowBuffer(200);
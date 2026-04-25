// Complex destructuring patterns with SlowBuffer
const { Buffer, constants } = require('buffer');
const { Buffer: SB } = require('buffer');
const { Buffer: SlowBuf, Buffer: Buf } = require('buffer');

// Various usage patterns
const buf1 = Buffer.allocUnsafeSlow(1024);
const buf2 = Buffer.allocUnsafeSlow(512);
const buf3 = SB.allocUnsafeSlow(256);
const buf4 = SlowBuf.allocUnsafeSlow(128);
// Complex destructuring patterns with SlowBuffer
const { SlowBuffer, Buffer, constants } = require('buffer');
const { SlowBuffer: SB } = require('buffer');
const { SlowBuffer: SlowBuf, Buffer: Buf } = require('buffer');

// Various usage patterns
const buf1 = new SlowBuffer(1024);
const buf2 = SlowBuffer(512);
const buf3 = new SB(256);
const buf4 = SlowBuf(128);
// Mixed with existing Buffer import
const { Buffer, SlowBuffer } = require('buffer');
const buf1 = new SlowBuffer(100);
const buf2 = Buffer.alloc(200);
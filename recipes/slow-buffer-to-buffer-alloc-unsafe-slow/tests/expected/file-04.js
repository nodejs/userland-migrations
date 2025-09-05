// Mixed with existing Buffer import
const { Buffer } = require('buffer');
const buf1 = Buffer.allocUnsafeSlow(100);
const buf2 = Buffer.alloc(200);
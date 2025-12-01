const Buffer = require('buffer').Buffer;

// Using SlowBuffer constructor
const buf1 = Buffer.allocUnsafeSlow(1024);
const buf2 = Buffer.allocUnsafeSlow(512);
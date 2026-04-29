const SlowBuffer = require('buffer').SlowBuffer;

// Using SlowBuffer constructor
const buf1 = new SlowBuffer(1024);
const buf2 = SlowBuffer(512);
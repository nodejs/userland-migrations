// Multiple arguments and expressions
const { Buffer } = require('buffer');

// SlowBuffer with complex expressions
const size = 1024;
const buf1 = Buffer.allocUnsafeSlow(size * 2);
const buf2 = Buffer.allocUnsafeSlow(Math.max(100, size));
const buf3 = Buffer.allocUnsafeSlow(size + 512);
const buf4 = Buffer.allocUnsafeSlow(parseInt('256'));

// SlowBuffer in nested contexts
function createBuffer(size) {
    return Buffer.allocUnsafeSlow(size);
}

const buffers = [
    Buffer.allocUnsafeSlow(64),
    Buffer.allocUnsafeSlow(128),
];
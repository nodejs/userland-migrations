// Multiple arguments and expressions
const { SlowBuffer } = require('buffer');

// SlowBuffer with complex expressions
const size = 1024;
const buf1 = new SlowBuffer(size * 2);
const buf2 = SlowBuffer(Math.max(100, size));
const buf3 = new SlowBuffer(size + 512);
const buf4 = SlowBuffer(parseInt('256'));

// SlowBuffer in nested contexts
function createBuffer(size) {
    return new SlowBuffer(size);
}

const buffers = [
    new SlowBuffer(64),
    SlowBuffer(128),
];
// Multiple SlowBuffer calls
const { Buffer } = require('buffer');

function createBuffers() {
  const buf1 = Buffer.allocUnsafeSlow(1024);
  const buf2 = Buffer.allocUnsafeSlow(512);
  return [buf1, buf2];
}
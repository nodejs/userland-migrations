// Multiple SlowBuffer calls
const { SlowBuffer } = require('buffer');

function createBuffers() {
  const buf1 = new SlowBuffer(1024);
  const buf2 = SlowBuffer(512);
  return [buf1, buf2];
}
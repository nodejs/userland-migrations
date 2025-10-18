const zlib = require("node:zlib");

// using let
let deflateStream = zlib.createDeflate();
console.log(deflateStream.bytesWritten);

// using var
var gzipStream = zlib.createGzip();
console.log(gzipStream.bytesWritten);
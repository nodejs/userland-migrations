const zlib = require("node:zlib");

// using let
let deflateStream = zlib.createDeflate();
console.log(deflateStream.bytesRead);

// using var
var gzipStream = zlib.createGzip();
console.log(gzipStream.bytesRead);
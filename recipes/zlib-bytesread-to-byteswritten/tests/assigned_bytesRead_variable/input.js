const zlib = require("node:zlib");
const gzip = zlib.createGzip();
const processed = gzip.bytesRead;

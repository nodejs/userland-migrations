const { createGzip } = require("node:zlib");
const gzip = createGzip();
const bytes = gzip.bytesRead;

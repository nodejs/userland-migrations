import { createGzip } from "node:zlib";
const gzip = createGzip();
const bytesProcessed = gzip.bytesWritten;

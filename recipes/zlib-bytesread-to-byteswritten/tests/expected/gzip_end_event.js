const zlib = require("node:zlib");
const gzip = zlib.createGzip();
gzip.on("end", () => {
    console.log("Bytes processed:", gzip.bytesWritten);
});

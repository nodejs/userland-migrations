const zlib = require("node:zlib");
const deflate = zlib.createDeflate();
deflate.on("finish", () => {
    const stats = {
        input: deflate.bytesRead,
        output: deflate.bytesWritten
    };
});
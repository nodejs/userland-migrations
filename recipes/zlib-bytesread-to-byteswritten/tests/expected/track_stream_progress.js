const zlib = require("node:zlib");
function trackProgress(stream) {
    setInterval(() => {
        console.log(`Progress: ${stream.bytesWritten} bytes`);
    }, 1000);
}
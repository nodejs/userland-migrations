const zlib = require("node:zlib");
function trackProgress(stream) {
    setInterval(() => {
        console.log(`Progress: ${stream.bytesRead} bytes`);
    }, 1000);
}
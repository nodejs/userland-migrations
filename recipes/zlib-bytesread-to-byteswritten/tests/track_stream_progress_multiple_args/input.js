const zlib = require("node:zlib");
function trackProgress(test, stream) {
    setInterval(() => {
        console.log(`Progress: ${stream.bytesRead} bytes`);
    }, 1000);
		console.log(test)
}

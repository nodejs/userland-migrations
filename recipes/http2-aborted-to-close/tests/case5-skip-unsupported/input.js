const http2 = require('node:http2');

const server = http2.createServer();
server.on('stream', (stream) => {
	// A named listener can be removed by identity elsewhere.
	stream.on('aborted', onAborted);
	// A listener with parameters is not the known handler shape.
	stream.on('aborted', (reason) => {
		log(reason);
	});
	// Property reads are reported, never rewritten.
	if (stream.aborted) {
		handleAbort();
	}
});

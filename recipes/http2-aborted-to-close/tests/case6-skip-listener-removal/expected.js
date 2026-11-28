const http2 = require('node:http2');

const server = http2.createServer();
server.on('stream', (stream) => {
	stream.on('aborted', () => {
		recordIncompleteResponse();
	});
	stream.removeAllListeners('aborted');
});

const http2 = require('node:http2');

const server = http2.createServer();
server.on('stream', (stream) => {
	stream.on('aborted', () => {
		recordIncompleteResponse();
	});
	stream.respond({ ':status': 200 });
	stream.end('ok');
});

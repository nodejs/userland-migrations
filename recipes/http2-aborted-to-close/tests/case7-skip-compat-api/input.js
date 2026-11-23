const http2 = require('node:http2');

const server = http2.createServer((req, res) => {
	req.on('aborted', () => {
		recordIncompleteRequest();
	});
	res.end('ok');
});

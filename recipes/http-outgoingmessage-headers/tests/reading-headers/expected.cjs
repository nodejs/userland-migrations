const http = require('http');

function handler(req, res) {
	res.setHeader('content-type', 'application/json');
	res.setHeader('x-custom-header', '42');

	console.log({
		headers: res.getHeaders(),
		headerNames: res.getRawHeaderNames(),
		customHeader: res.getHeaders()['x-custom-header'],
		count: Object.keys(res.getHeaders()).length,
	});

	res.end('Hello World');
}

const server = http.createServer(handler);

server.listen(3000, () => {
	console.log('Server running on port 3000');
});

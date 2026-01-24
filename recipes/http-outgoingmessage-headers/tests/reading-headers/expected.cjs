const http = require('http');

const server = http.createServer((req, res) => {
	res.setHeader('content-type', 'application/json');
	res.setHeader('x-custom-header', '42');

	console.log({
		headers: res.getHeaders(),
		headerNames: res.getRawHeaderNames(),
		customHeader: res.getHeader('x-custom-header'),
		count: Object.keys(res.getHeaders()).length,
	});

	res.end('Hello World');
});

server.listen(3000, () => {
	console.log('Server running on port 3000');
});

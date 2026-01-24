const http = require('http');

const server = http.createServer((req, res) => {
	res.setHeader('content-type', 'application/json');
	res.setHeader('x-custom-header', '42');

	console.log({
		headers: res._headers,
		headerNames: res._headerNames,
		customHeader: res._headers['x-custom-header'],
		count: Object.keys(res._headers).length,
	});

	res.end('Hello World');
});

server.listen(3000, () => {
	console.log('Server running on port 3000');
});

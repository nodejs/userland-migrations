const http = require('http');

const server = http.createServer((req, res) => {
	res.setHeader('content-type', 'application/json');
	res.setHeader('x-custom-header', '42');

	if ('x-custom-header' in res.getHeaders()) {
		console.log('exists');
	}

	if (Object.prototype.hasOwnProperty.call(res.getHeaders(), 'x-custom-header')) {
		console.log('exists');
	}

	if (res.getHeaders()['x-custom-header'] !== undefined) {
		console.log('exists');
	}

	if (Object.keys(res.getHeaders()).includes('x-custom-header')) {
		console.log('exists');
	}

	if (Reflect.has(res.getHeaders(), 'x-custom-header')) {
		console.log('exists');
	}

	res.end('Hello World');
});

server.listen(3000, () => {
	console.log('Server running on port 3000');
});

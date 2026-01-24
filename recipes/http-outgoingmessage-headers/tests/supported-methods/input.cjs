const http = require('http');

const server = http.createServer((req, res) => {
	res.setHeader('content-type', 'application/json');
	res.setHeader('x-custom-header', '42');

	console.log({
		createServer: res._headers,
	});

	res.end('Hello World');
});

server.on('request', (req, res) => {
	console.log({
		serverOnRequest: res._headers,
	});
});

const event = 'request';

const listener = (req, res) => {
	console.log({
		serverOnRequest: res._headers,
	});
};

server.on(event, listener);

server.listen(3000, () => {
	console.log('Server running on port 3000');
});

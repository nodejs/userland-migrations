const http = require('http');

const server = http.createServer((req, res) => {
	res.setHeader('content-type', 'application/json');
	res.setHeader('x-custom-header', '42');

	console.log({
		createServer: res.getHeaders(),
	});

	res.end('Hello World');
});

server.on('request', (req, res) => {
	console.log({
		serverOnRequest: res.getHeaders(),
	});
});

const event = 'request';

const listener = (req, res) => {
	console.log({
		serverOnRequest: res.getHeaders(),
	});
};

server.on(event, listener);

server.listen(3000, () => {
	console.log('Server running on port 3000');
});

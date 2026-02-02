const http = require('http');

const server = http.createServer((req, res) => {
	res.setHeader('content-type', 'application/json');
	res.setHeader('x-custom-header', '42');

	for (const name in res.getHeaders()) {
		console.log(res.getHeaders()[name]);
	}

	Object.keys(res.getHeaders()).forEach((name) => {
		console.log(res.getHeaders()[name]);
	});

	Object.values(res.getHeaders()).forEach((value) => {
		console.log(value);
	});

	Object.entries(res.getHeaders()).forEach(([name, value]) => {
		console.log(value);
	});

	for (const [name, value] of Object.entries(res.getHeaders())) {
		console.log(value);
	}

	for (const value of Object.values(res.getHeaders())) {
		console.log(value);
	}

	const headerNames = Object.keys(res.getHeaders());
	for (let i = 0; i < headerNames.length; i++) {
		console.log(res.getHeaders()[headerNames[i]]);
	}

	Object.getOwnPropertyNames(res.getHeaders()).forEach((name) => {
		console.log(res.getHeaders()[name]);
	});

	Array.from(res.getRawHeaderNames()).forEach((name) => {
		console.log(name);
	});

	for (const name in res.getRawHeaderNames()) {
		console.log(res.getRawHeaderNames()[name]);
	}

	for (const [index, name] of Object.entries(res.getRawHeaderNames())) {
		console.log(name);
	}

	res.end('Hello World');
});

server.listen(3000, () => {
	console.log('Server running on port 3000');
});

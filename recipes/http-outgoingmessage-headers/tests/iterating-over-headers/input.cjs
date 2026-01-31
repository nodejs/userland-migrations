const http = require('http');

const server = http.createServer((req, res) => {
	res.setHeader('content-type', 'application/json');
	res.setHeader('x-custom-header', '42');

	for (const name in res._headers) {
		console.log(res._headers[name]);
	}

	Object.keys(res._headers).forEach((name) => {
		console.log(res._headers[name]);
	});

	Object.values(res._headers).forEach((value) => {
		console.log(value);
	});

	Object.entries(res._headers).forEach(([name, value]) => {
		console.log(value);
	});

	for (const [name, value] of Object.entries(res._headers)) {
		console.log(value);
	}

	for (const value of Object.values(res._headers)) {
		console.log(value);
	}

	const headerNames = Object.keys(res._headers);
	for (let i = 0; i < headerNames.length; i++) {
		console.log(res._headers[headerNames[i]]);
	}

	Object.getOwnPropertyNames(res._headers).forEach((name) => {
		console.log(res._headers[name]);
	});

	Array.from(res._headerNames).forEach((name) => {
		console.log(name);
	});

	for (const name in res._headerNames) {
		console.log(res._headerNames[name]);
	}

	for (const [index, name] of Object.entries(res._headerNames)) {
		console.log(name);
	}

	res.end('Hello World');
});

server.listen(3000, () => {
	console.log('Server running on port 3000');
});

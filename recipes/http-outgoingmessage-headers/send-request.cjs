const http = require('http');

const req = http.request(
	{
		hostname: 'localhost',
		port: 3000,
		headers: {
			'content-type': 'application/json',
			'x-custom-header': '42',
		},
	},
	(res) => {
		console.log('Response headers:', Object.keys(res.headers));

		res.on('end', () => {
			server.close();
		});
	},
);

req.end();

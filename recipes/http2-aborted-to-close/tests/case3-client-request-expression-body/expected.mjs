import http2 from 'node:http2';

const client = http2.connect('https://example.com');
const req = client.request({ ':path': '/' });
req.on('close', () => {
	if (!req.writableFinished) {
		cleanup(req);
	}
});
req.end();

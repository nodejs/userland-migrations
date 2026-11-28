const http2 = require('node:http2');
const client = http2.connect('https://example.com');
const req = client.request();
req.on('close', () => {
	if (req.writableFinished) return;
	return cleanup();
});
req.once('close', async () => {
	if (req.writableFinished) return;
	return cleanup();
});

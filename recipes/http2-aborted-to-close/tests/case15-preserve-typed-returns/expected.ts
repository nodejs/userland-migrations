import http2 from 'node:http2';
declare function cleanup(): Promise<void>;
const client = http2.connect('https://example.com');
const req = client.request();
req.on('close', (): (Promise<void>) | undefined => {
	if (req.writableFinished) return;
	return cleanup();
});
req.once('close', async (): Promise<(number) | undefined> => {
	if (req.writableFinished) return;
	return 1;
});
req.on('close', (): (number) | undefined => { if (req.writableFinished) return; return 1; });
req.on('close', async (): Promise<void> => { if (req.writableFinished) return; await cleanup(); });

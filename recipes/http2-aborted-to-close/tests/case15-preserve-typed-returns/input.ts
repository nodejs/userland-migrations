import http2 from 'node:http2';
declare function cleanup(): Promise<void>;
const client = http2.connect('https://example.com');
const req = client.request();
req.on('aborted', (): Promise<void> => cleanup());
req.once('aborted', async (): Promise<number> => 1);
req.on('aborted', (): number => { return 1; });
req.on('aborted', async (): Promise<void> => { await cleanup(); });

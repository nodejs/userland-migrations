import * as http2 from 'node:http2';
import type { ServerHttp2Stream } from 'node:http2';

const server = http2.createSecureServer({ key, cert });
server.on('stream', (stream: ServerHttp2Stream) => {
	stream.on('close', (): void => {
		if (stream.writableFinished) return;
		recordIncompleteResponse();
	});
});

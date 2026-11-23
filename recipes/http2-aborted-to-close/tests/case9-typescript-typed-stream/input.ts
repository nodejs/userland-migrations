import * as http2 from 'node:http2';
import type { ServerHttp2Stream } from 'node:http2';

const server = http2.createSecureServer({ key, cert });
server.on('stream', (stream: ServerHttp2Stream) => {
	stream.on('aborted', (): void => {
		recordIncompleteResponse();
	});
});

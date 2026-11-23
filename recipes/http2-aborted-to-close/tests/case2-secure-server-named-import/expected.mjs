import { createSecureServer as createServer } from 'http2';

const server = createServer({ key, cert });
server.once("stream", function (stream, headers) {
	stream.once("close", function () {
		if (!stream.writableFinished) {
			metrics.increment("aborted");
			log(headers[":path"]);
		}
	});
});

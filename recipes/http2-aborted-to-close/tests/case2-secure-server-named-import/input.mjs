import { createSecureServer as createServer } from 'http2';

const server = createServer({ key, cert });
server.once("stream", function (stream, headers) {
	stream.once("aborted", function () {
		metrics.increment("aborted");
		log(headers[":path"]);
	});
});

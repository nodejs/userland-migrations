const { Transform } = require("node:stream");

const transform = new Transform({
	async transform(chunk, encoding, callback) {
		const result = await processChunk(chunk);
		callback(null, result);
	}
});

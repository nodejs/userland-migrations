const { Transform } = require("node:stream");

const transform = new Transform({
	transform(chunk, encoding, callback) {
		processChunk(chunk)
			.then(result => callback(null, result))
			.catch(err => callback(err));
	}
});

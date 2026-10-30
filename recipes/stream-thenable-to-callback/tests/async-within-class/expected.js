const { Writable } = require("node:stream");

class MyWritable extends Writable {
	_write(chunk, encoding, callback) {
		this.processChunk(chunk)
			.then(() => callback())
			.catch(err => callback(err));
	}

	async processChunk(chunk) {
		// async processing
	}
}

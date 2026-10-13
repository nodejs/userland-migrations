const { Writable } = require("node:stream");

const writable = new Writable({
	write(chunk, encoding, callback) {
		someAsyncOperation(chunk)
			.then(() => callback())
			.catch(err => callback(err));
	}
});

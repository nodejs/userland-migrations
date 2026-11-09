const { Writable } = require("node:stream");

const writable = new Writable({
	async write(chunk, encoding, callback) {
		await someAsyncOperation(chunk);
		callback();
	}
});

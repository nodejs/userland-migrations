const { Writable } = require("node:stream");

const writable = new Writable({
	async write(chunk, encoding, callback) {
		try {
			await someAsyncWork(chunk);
			callback();
		} catch (err) {
			callback(err);
		}
	}
});

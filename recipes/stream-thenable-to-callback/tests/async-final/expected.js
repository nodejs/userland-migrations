const { Writable } = require("node:stream");

const writable = new Writable({
	write(chunk, encoding, callback) {
		// write implementation
		callback();
	},
	final(callback) {
		cleanup()
			.then(() => callback())
			.catch(err => callback(err));
	}
});

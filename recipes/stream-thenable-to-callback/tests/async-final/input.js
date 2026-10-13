const { Writable } = require("node:stream");

const writable = new Writable({
	write(chunk, encoding, callback) {
		// write implementation
		callback();
	},
	async final(callback) {
		await cleanup();
		callback();
	}
});

const { Writable } = require("node:stream");

const writable = new Writable({
	async write(chunk, encoding, callback) {
		const [value = initialize()] = await save(chunk);
		callback();
	}
});

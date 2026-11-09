const { Transform } = require("node:stream");

const transform = new Transform({
	transform(chunk, encoding, callback) {
		this.push(chunk);
		callback();
	},
	async flush(callback) {
		await finalizeStream();
		callback();
	}
});

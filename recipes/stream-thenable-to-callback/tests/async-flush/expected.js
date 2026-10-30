const { Transform } = require("node:stream");

const transform = new Transform({
	transform(chunk, encoding, callback) {
		this.push(chunk);
		callback();
	},
	flush(callback) {
		finalizeStream()
			.then(() => callback())
			.catch(err => callback(err));
	}
});

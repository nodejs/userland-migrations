const { Writable } = require("node:stream");

const writable = new Writable({
	write(chunk, encoding, callback) {
		save(chunk)
			.then(([value = initialize()]) => callback())
			.catch(err => callback(err));
	}
});

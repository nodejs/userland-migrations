function first() {
	const { Writable } = require("node:stream");
	return new Writable({
		write(chunk, encoding, callback) {
			save(chunk)
				.then(() => callback())
				.catch(err => callback(err));
		}
	});
}

function second() {
	const { Writable } = require("stream");
	return new Writable({
		write(chunk, encoding, callback) {
			save(chunk)
				.then(() => callback())
				.catch(err => callback(err));
		}
	});
}

function custom() {
	const { Writable } = require("custom-stream");
	return new Writable({
		async write(chunk, encoding, callback) {
			await save(chunk);
			callback();
		}
	});
}

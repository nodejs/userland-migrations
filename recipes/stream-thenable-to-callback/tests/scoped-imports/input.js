function first() {
	const { Writable } = require("node:stream");
	return new Writable({
		async write(chunk, encoding, callback) {
			await save(chunk);
			callback();
		}
	});
}

function second() {
	const { Writable } = require("stream");
	return new Writable({
		async write(chunk, encoding, callback) {
			await save(chunk);
			callback();
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

const { Writable } = require("node:stream");

function build(Writable) {
	return new Writable({
		async write(chunk, encoding, callback) {
			await save(chunk);
			callback();
		}
	});
}

const writable = new Writable({
	write(chunk, encoding, callback) {
		save(chunk)
			.then(() => callback())
			.catch(err => callback(err));
	}
});

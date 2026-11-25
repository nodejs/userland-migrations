const stream = require("node:stream");

{
	const stream = customStream;
	const custom = new stream.Writable({
		write: async function (chunk, encoding, callback) {
			await save(chunk);
			callback();
		}
	});
}

const writable = new stream.Writable({
	write(chunk, encoding, callback) {
		save(chunk)
			.then(() => callback())
			.catch(err => callback(err));
	}
});

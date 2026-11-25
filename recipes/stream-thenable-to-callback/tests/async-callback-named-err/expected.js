const { Writable } = require("node:stream");

const writable = new Writable({
	write(chunk, encoding, err) {
		someAsyncOperation(chunk)
			.then(() => err())
			.catch(error => err(error));
	}
});

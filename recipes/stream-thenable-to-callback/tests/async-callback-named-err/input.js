const { Writable } = require("node:stream");

const writable = new Writable({
	async write(chunk, encoding, err) {
		await someAsyncOperation(chunk);
		err();
	}
});

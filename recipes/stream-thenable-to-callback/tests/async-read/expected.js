const { Readable } = require("node:stream");

const readable = new Readable({
	read(size) {
		fetchData(size)
			.then(data => this.push(data))
			.catch(err => this.destroy(err));
	}
});

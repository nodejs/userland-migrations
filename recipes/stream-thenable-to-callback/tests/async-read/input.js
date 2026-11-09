const { Readable } = require("node:stream");

const readable = new Readable({
	async read(size) {
		const data = await fetchData(size);
		this.push(data);
	}
});

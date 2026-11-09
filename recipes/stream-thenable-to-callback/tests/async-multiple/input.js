const { Transform } = require("node:stream");

const transform = new Transform({
	async transform(chunk, encoding, callback) {
		const step1 = await operation1(chunk);
		const step2 = await operation2(step1);
		callback(null, step2);
	}
});

const { Transform } = require("node:stream");

const transform = new Transform({
	transform(chunk, encoding, callback) {
		operation1(chunk)
			.then(step1 => operation2(step1))
			.then(step2 => callback(null, step2))
			.catch(err => callback(err));
	}
});

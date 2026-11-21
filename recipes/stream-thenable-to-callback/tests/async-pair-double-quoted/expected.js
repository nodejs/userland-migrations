import { Writable } from 'node:stream';

const stream = new Writable({
	"write": function (chunk, encoding, callback)
	{
		save(chunk)
			.then(() => callback())
			.catch(err => callback(err));
	},
});

const stream2 = new Writable({
	"write": (chunk, encoding, callback) => {
		save(chunk)
			.then(() => callback())
			.catch(err => callback(err));
	},
});

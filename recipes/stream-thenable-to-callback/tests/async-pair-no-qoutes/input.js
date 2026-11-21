import { Writable } from 'node:stream';

const stream = new Writable({
	write: async function (chunk, encoding, callback) {
		await save(chunk);
		callback();
	},
	objectMode: true
});

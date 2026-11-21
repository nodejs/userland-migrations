import { Writable } from 'node:stream';

const stream = new Writable({
	'write': function (chunk, encoding, callback)
	{
		save(chunk)
			.then(() => callback())
			.catch(err => callback(err));
	},
});

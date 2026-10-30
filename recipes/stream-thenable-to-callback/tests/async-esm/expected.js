import { Writable } from "node:stream";

export const writable = new Writable({
	write(chunk, encoding, callback) {
		database.insert(chunk.toString())
			.then(() => callback())
			.catch(err => callback(err));
	}
});

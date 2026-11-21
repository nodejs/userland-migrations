import { Writable } from "node:stream";

export const writable = new Writable({
	async write(chunk, encoding, callback) {
		await database.insert(chunk.toString());
		callback();
	}
});

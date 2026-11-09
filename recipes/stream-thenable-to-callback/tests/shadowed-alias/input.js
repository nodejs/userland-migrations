import { Writable as Sink } from "node:stream";

const build = ({ Sink }) => new Sink({
	async write(chunk, encoding, callback) {
		await save(chunk);
		callback();
	}
});

const writable = new Sink({
	async write(chunk, encoding, callback) {
		await save(chunk);
		callback();
	}
});

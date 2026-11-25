import("node:stream").then(stream => {
	function build(stream) {
		return new stream.Writable({
			async write(chunk, encoding, callback) {
				await save(chunk);
				callback();
			}
		});
	}

	const writable = new stream.Writable({
		async write(chunk, encoding, callback) {
			await save(chunk);
			callback();
		}
	});
});

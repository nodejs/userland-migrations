import("node:http2").then((http2) => {
	const session = http2.connect("https://example.com");
	session.settings({
		enablePush: true,
		priority: { weight: 16 }
	});
});
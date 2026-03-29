import('node:tls').then(tls => {
	const pair = tls.createSecurePair(credentials);
});

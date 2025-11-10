import('node:tls').then(tls => {
	const socket = new tls.TLSSocket(underlyingSocket, { secureContext: credentials });
});

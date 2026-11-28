async function init() {
	const { TLSSocket } = await import('node:tls');
	const { SecureContext } = await import('node:tls');
	const connect = await import('node:tls').then((m) => m.connect);
	return { TLSSocket, SecureContext, connect };
}

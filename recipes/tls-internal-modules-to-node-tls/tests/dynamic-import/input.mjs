async function init() {
	const { TLSSocket } = await import('_tls_wrap');
	const { SecureContext } = await import('node:_tls_common');
	const connect = await import('_tls_wrap').then((m) => m.connect);
	return { TLSSocket, SecureContext, connect };
}

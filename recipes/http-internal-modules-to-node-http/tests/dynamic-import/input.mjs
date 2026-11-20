async function load() {
	const { Server } = await import('_http_server');
	const { IncomingMessage } = await import('node:_http_incoming');
	const agent = await import('_http_agent').then((m) => m.Agent);
	return { Server, IncomingMessage, agent };
}

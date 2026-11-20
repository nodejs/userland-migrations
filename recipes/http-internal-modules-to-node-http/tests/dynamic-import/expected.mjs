async function load() {
	const { Server } = await import('node:http');
	const { IncomingMessage } = await import('node:http');
	const agent = await import('node:http').then((m) => m.Agent);
	return { Server, IncomingMessage, agent };
}

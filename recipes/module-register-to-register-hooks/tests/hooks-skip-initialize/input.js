let port;

export async function initialize(data) {
	port = data.port;
}

export async function resolve(specifier, context, nextResolve) {
	return await nextResolve(specifier, context);
}

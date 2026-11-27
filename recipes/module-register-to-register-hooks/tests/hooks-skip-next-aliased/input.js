export async function resolve(specifier, context, nextResolve) {
	const forward = nextResolve;
	return forward(specifier, context);
}

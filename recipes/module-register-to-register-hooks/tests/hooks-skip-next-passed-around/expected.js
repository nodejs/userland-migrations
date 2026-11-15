export async function resolve(specifier, context, nextResolve) {
	return await wrap(nextResolve)(specifier, context);
}

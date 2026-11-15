export async function resolve(specifier, context, nextResolve) {
	return await nextResolve(specifier, context);
}

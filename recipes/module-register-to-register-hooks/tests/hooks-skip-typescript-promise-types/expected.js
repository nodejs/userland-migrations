export async function resolve(
	specifier: string,
	context: object,
	nextResolve: (specifier: string, context: object) => Promise<{ url: string }>,
): Promise<{ url: string }> {
	return await nextResolve(specifier, context);
}

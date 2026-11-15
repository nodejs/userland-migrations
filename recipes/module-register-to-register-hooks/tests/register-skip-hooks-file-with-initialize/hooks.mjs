export async function initialize(data) {}

export async function resolve(specifier, context, nextResolve) {
	return nextResolve(specifier, context);
}

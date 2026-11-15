export function resolve(specifier, context, nextResolve) {
	return Promise.resolve(nextResolve(specifier, context));
}

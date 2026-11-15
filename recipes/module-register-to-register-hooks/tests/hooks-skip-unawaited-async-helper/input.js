async function lookup(specifier) {
	return specifier;
}

export async function resolve(specifier, context, nextResolve) {
	const found = lookup(specifier);
	nextResolve(specifier, context);
	return found;
}

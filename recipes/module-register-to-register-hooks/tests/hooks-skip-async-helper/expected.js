async function lookup(specifier) {
	return specifier;
}

export async function resolve(specifier, context, nextResolve) {
	return nextResolve(await lookup(specifier), context);
}

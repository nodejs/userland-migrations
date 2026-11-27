export async function resolve(specifier, context, nextResolve) {
	return await somethingElse(specifier);
}

export async function other() {
	return await fetch("https://example.com");
}

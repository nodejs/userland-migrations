function resolve(specifier, context, nextResolve) {
	return nextResolve(specifier, context);
}

function load(url, context, nextLoad) {
	return nextLoad(url, context);
}

export { resolve, load as default };
export { load };

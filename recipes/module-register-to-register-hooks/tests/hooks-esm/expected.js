export function resolve(specifier, context, nextResolve) {
	if (specifier === "virtual:answer") {
		return { url: "virtual:answer", shortCircuit: true };
	}

	return nextResolve(specifier, context);
}

export function load(url, context, nextLoad) {
	const result = nextLoad(url, context);

	if (result.format === "module") {
		return { ...result, source: String(result.source).toUpperCase() };
	}

	return result;
}

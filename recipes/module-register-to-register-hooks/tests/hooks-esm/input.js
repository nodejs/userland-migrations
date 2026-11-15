export async function resolve(specifier, context, nextResolve) {
	if (specifier === "virtual:answer") {
		return { url: "virtual:answer", shortCircuit: true };
	}

	return await nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
	const result = await nextLoad(url, context);

	if (result.format === "module") {
		return { ...result, source: String(result.source).toUpperCase() };
	}

	return result;
}

export async function resolve(specifier, context, nextResolve) {
	return nextResolve(specifier, context).catch(() => ({ url: specifier, shortCircuit: true }));
}

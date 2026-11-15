export const resolve = async function* (specifier, context, nextResolve) {
	yield nextResolve(specifier, context);
};

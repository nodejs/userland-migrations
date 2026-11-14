export const resolve = (specifier, context, nextResolve) => {
	const { url, ...rest } = nextResolve(specifier, context);
	return { url, ...rest };
};

export const load = (url, context, nextLoad) => (nextLoad(url, context));

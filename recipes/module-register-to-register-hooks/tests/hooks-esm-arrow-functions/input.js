export const resolve = async (specifier, context, nextResolve) => {
	const { url, ...rest } = await nextResolve(specifier, context);
	return { url, ...rest };
};

export const load = async (url, context, nextLoad) => (await nextLoad(url, context));

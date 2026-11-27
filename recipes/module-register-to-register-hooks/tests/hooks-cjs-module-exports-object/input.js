async function resolve(specifier, context, nextResolve) {
	return await nextResolve(specifier, context);
}

module.exports = {
	resolve,
	async load(url, context, nextLoad) {
		return await nextLoad(url, context);
	},
};

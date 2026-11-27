function resolve(specifier, context, nextResolve) {
	return nextResolve(specifier, context);
}

module.exports = {
	resolve,
	load(url, context, nextLoad) {
		return nextLoad(url, context);
	},
};

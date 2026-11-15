exports.resolve = function (specifier, context, nextResolve) {
	return nextResolve(specifier, context);
};

module.exports.load = (url, context, nextLoad) => {
	return nextLoad(url, context);
};

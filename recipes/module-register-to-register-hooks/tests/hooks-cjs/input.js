exports.resolve = async function (specifier, context, nextResolve) {
	return await nextResolve(specifier, context);
};

module.exports.load = async (url, context, nextLoad) => {
	return await nextLoad(url, context);
};

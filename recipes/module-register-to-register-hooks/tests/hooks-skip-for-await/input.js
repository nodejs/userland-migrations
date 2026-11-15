export async function load(url, context, nextLoad) {
	for await (const chunk of source(url)) {
		console.log(chunk);
	}

	return nextLoad(url, context);
}

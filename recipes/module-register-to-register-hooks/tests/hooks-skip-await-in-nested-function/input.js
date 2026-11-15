export async function load(url, context, nextLoad) {
	const results = [url].map(async (u) => await nextLoad(u, context));
	return results[0];
}

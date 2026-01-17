
const payload = { status: 'open' };

const updated = await fetch('https://dummyjson.com/forms/1', {
	method: "PUT",
	body: (() => {
	const value = payload;
	if (value instanceof FormData || value instanceof URLSearchParams) return value;
	return new URLSearchParams(value);
})()
})
	.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
	.catch(() => null);
console.log(updated.status);

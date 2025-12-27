
const formData = new FormData();
formData.append('name', 'Node.js');

await fetch('https://dummyjson.com/forms', {
	method: 'POST',
	body: (() => {
		const value = formData;
		if (value instanceof FormData || value instanceof URLSearchParams) return value;
		return new URLSearchParams(value);
	})()
})
	.then(async (res) => Object.assign(res, { data: await res.json() }))
	.catch(() => null);

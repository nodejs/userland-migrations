
const patched = await fetch('https://dummyjson.com/forms/2', {
	method: 'PATCH',
	headers: {
				Accept: 'application/json',
			},
	body: new URLSearchParams({ done: true })
})
	.then(async (res) => Object.assign(res, { data: await res.json() }))
	.catch(() => null);
console.log(patched.status);

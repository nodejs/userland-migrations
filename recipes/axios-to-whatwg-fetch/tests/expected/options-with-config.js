
const all = await fetch('https://dummyjson.com/todos', {
	method: 'OPTIONS',
	headers: { 'Content-Type': 'application/json' }
})
	.then(async (res) => Object.assign(res, { data: await res.json() }))
	.catch(() => null);

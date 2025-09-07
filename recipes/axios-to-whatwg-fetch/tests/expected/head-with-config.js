
const all = await fetch('https://dummyjson.com/todos', {
	method: 'HEAD',
	headers: { 'Content-Type': 'application/json' },
})
	.then(async (res) => Object.assign(res, { data: await res.json() }))
	.catch(() => null);

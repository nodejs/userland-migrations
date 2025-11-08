
const all = await fetch('https://dummyjson.com/todos', { method: 'HEAD' })
	.then(async (res) => Object.assign(res, { data: await res.json() }))
	.catch(() => null);

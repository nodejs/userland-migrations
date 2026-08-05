
const all = await fetch('https://dummyjson.com/todos', { method: "OPTIONS" })
	.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
	.catch(() => null);

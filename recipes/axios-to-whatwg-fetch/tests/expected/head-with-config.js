
const all = await fetch('https://dummyjson.com/todos', {
	method: "HEAD",
	headers: { 'Content-Type': 'application/json' }
})
	.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
	.catch(() => null);

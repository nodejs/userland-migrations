
const all = await fetch('https://dummyjson.com/todos', {

"method": "HEAD",

"headers": {}
})
	.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
	.catch(() => null);

const base = 'https://dummyjson.com/todos/add';

const todoCreated = await fetch(base, {

"method": "POST",

"body": "JSON.stringify({
\ttodo: 'Use DummyJSON in the project',
\tcompleted: false,
\tuserId: 5,
})"
})
	.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
	.catch(() => null);
console.log('\nPOST /todos ->', todoCreated);

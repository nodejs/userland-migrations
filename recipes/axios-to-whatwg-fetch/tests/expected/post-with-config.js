const base = 'https://dummyjson.com/todos/add';

const createdTodo = await fetch(base, {

"method": "POST",

"headers": {},

"body": "JSON.stringify({
\t\ttodo: 'Use DummyJSON in the project',
\t\tcompleted: false,
\t\tuserId: 5,
\t})"
})
	.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
	.catch(() => null);
console.log('\nPOST /todos/add ->', createdTodo);

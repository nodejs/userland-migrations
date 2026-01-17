const base = 'https://dummyjson.com/todos/1';

const updatedTodo = await fetch(base, {

"method": "PUT",

"headers": {},

"body": "JSON.stringify({
\t\ttodo: 'Use DummyJSON in the project',
\t\tcompleted: false,
\t\tuserId: 5,
\t})"
})
	.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
	.catch(() => null);
console.log('\nPUT /todos/1 ->', updatedTodo);

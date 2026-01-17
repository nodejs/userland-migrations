const base = 'https://dummyjson.com/todos/1';

const updatedTodo = await fetch(base, {

"method": "PUT",

"body": "JSON.stringify({
\ttodo: 'Use DummyJSON in the project',
\tcompleted: false,
\tuserId: 5,
})"
})
	.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
	.catch(() => null);
console.log('\nPUT /todos/1 ->', updatedTodo);

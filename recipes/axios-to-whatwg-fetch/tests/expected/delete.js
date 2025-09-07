const base = 'https://dummyjson.com/todos/1';

const deletedTodo = await fetch(base, { method: 'DELETE' })
	.then(async (res) => Object.assign(res, { data: await res.json() }))
	.catch(() => null);
console.log('\nDELETE /todos ->', deletedTodo);

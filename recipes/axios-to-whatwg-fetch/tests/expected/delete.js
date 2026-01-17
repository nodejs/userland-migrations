const base = 'https://dummyjson.com/todos/1';

const deletedTodo = await fetch(base, {"method":"DELETE"})
	.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
	.catch(() => null);
console.log('\nDELETE /todos ->', deletedTodo);

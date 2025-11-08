
const deletedTodo = await fetch('https://dummyjson.com/todos/1', {
	method: 'DELETE',
	headers: { 'Content-Type': 'application/json' }
})
	.then(async (res) => Object.assign(res, { data: await res.json() }))
	.catch(() => null);
console.log('\nDELETE /todos1/1 ->', deletedTodo);

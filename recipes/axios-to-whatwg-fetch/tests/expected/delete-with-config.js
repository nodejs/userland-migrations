
const deletedTodo = await fetch('https://dummyjson.com/todos/1', {
	method: "DELETE",
	headers: { 'Content-Type': 'application/json' }
})
	.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
	.catch(() => null);
console.log('\nDELETE /todos1/1 ->', deletedTodo);

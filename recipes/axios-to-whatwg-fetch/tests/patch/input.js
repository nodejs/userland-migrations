
// Unsupported method: axios.patch
const base = 'https://dummyjson.com/todos/1';

const patchedTodo = await fetch(base, {
	method: "PATCH",
	body: JSON.stringify({
		todo: 'Updated todo',
		completed: true,
	})
})
	.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
	.catch(() => null);
console.log('\nPATCH /todos/1 ->', patchedTodo);

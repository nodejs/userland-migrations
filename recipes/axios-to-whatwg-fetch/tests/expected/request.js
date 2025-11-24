
const base = 'https://dummyjson.com/todos/1';

const customRequest = await fetch(base, {
	method: 'PATCH',
	body: JSON.stringify({
			todo: 'Updated todo',
			completed: true,
		})
})
	.then(async (res) => Object.assign(res, { data: await res.json() }))
	.catch(() => null);
console.log('\nREQUEST /todos/1 ->', customRequest);

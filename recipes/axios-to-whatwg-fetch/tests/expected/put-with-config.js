const base = 'https://dummyjson.com/todos/1';

const updatedTodo = await fetch(base, {
	method: 'PUT',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
			todo: 'Use DummyJSON in the project',
			completed: false,
			userId: 5,
		})

})
	.then(async (res) => Object.assign(res, { data: await res.json() }))
	.catch(() => null);
console.log('\nPUT /todos/1 ->', updatedTodo);

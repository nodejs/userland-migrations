
const base = 'https://dummyjson.com/todos/1';

const customRequest = await fetch(base, {

"method": "PATCH",

"body": "JSON.stringify({
\t\ttodo: 'Updated todo',
\t\tcompleted: true,
\t})"
})
	.then(async (resp) => Object.assign(resp, { data: await resp.json() }))
	.catch(() => null);
console.log('\nREQUEST /todos/1 ->', customRequest);
